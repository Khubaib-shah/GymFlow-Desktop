import type { DeviceAttendancePayload } from "../types";

function getAttendanceTimestamp(logItem: DeviceAttendancePayload): Date {
  const raw =
    logItem.timestamp ??
    (logItem as any).attTime ??
    (logItem as any).checkInTime;

  if (raw == null) return new Date();

  const d = new Date(raw as any);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

function roundToSeconds(d: Date): Date {
  const ms = d.getMilliseconds();
  if (!ms) return d;
  return new Date(d.getTime() - ms);
}

export async function upsertAttendanceFromBiometric(args: {
  prisma: any;
  member: any;
  deviceUserId: number;
  logItem: DeviceAttendancePayload;
}): Promise<{
  ipcEvent: "attendance:checkin" | "attendance:checkout";
  attendance: any;
}> {
  const { prisma, member, logItem } = args;

  const now = roundToSeconds(new Date());

  // Heuristic: use a session window similar to manual flow (6 hours)
  const sixHoursAgo = new Date(now);
  sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

  // Device logs can contain duplicates; normalize the computed check-in time.
  const checkInTime = roundToSeconds(getAttendanceTimestamp(logItem));

  // Duplicate prevention:
  // 1) If we already have an active session, close it (checkout).
  // 2) Avoid rapid re-checkout if device sends the same event repeatedly.
  const activeSession = await prisma.attendance.findFirst({
    where: {
      memberId: member.id,
      checkOutTime: null,
      checkInTime: { gte: sixHoursAgo },
    },
    orderBy: { checkInTime: "desc" },
  });

  if (activeSession) {
    const alreadyClosedWithin1s =
      activeSession.checkOutTime != null &&
      Math.abs(
        new Date(activeSession.checkOutTime).getTime() - now.getTime(),
      ) <= 1000;

    // If checkOutTime is null, alreadyClosedWithin1s will be false; keep logic explicit.
    if (!alreadyClosedWithin1s) {
      const updated = await prisma.attendance.update({
        where: { id: activeSession.id },
        data: { checkOutTime: now, method: "BIOMETRIC" },
      });
      return { ipcEvent: "attendance:checkout", attendance: updated };
    }

    return { ipcEvent: "attendance:checkout", attendance: activeSession };
  }

  // If no active session, ensure we don't create a duplicate check-in for the same second.
  const nearDuplicate = await prisma.attendance.findFirst({
    where: {
      memberId: member.id,
      checkInTime: {
        gte: new Date(checkInTime.getTime()),
        lte: new Date(checkInTime.getTime()),
      },
      method: "BIOMETRIC",
    },
  });

  if (nearDuplicate) {
    return { ipcEvent: "attendance:checkin", attendance: nearDuplicate };
  }

  const created = await prisma.attendance.create({
    data: {
      memberId: member.id,
      checkInTime,
      method: "BIOMETRIC",
    },
  });

  return { ipcEvent: "attendance:checkin", attendance: created };
}
