import type { DeviceAttendancePayload } from "../types";
import { deviceLogger } from "../DeviceLogger";

function getAttendanceTimestamp(logItem: DeviceAttendancePayload): Date {
  // Device may return timestamp in various formats - try all common ones
  const raw =
    logItem.timestamp ??
    (logItem as any).attTime ??
    (logItem as any).checkInTime ??
    (logItem as any).checkTime ??
    (logItem as any).date;

  deviceLogger.info("Raw timestamp from device log", { raw, logItem });

  if (raw == null) {
    deviceLogger.warn("No timestamp found in log item, using current time");
    return new Date();
  }

  // Handle different timestamp formats
  let d: Date;

  // If it's a number, it might be Unix timestamp (seconds or milliseconds)
  if (typeof raw === 'number') {
    // If the number is small (< 10^10), it's probably seconds since epoch
    const ms = raw < 10000000000 ? raw * 1000 : raw;
    d = new Date(ms);
    deviceLogger.info("Parsed numeric timestamp", { raw, ms, parsed: d.toISOString() });
  } else if (typeof raw === 'string') {
    // Try parsing as ISO string or other formats
    d = new Date(raw);
    deviceLogger.info("Parsed string timestamp", { raw, parsed: d.toISOString() });
  } else {
    d = new Date(raw);
    deviceLogger.info("Parsed object timestamp", { parsed: d.toISOString() });
  }

  if (Number.isNaN(d.getTime())) {
    deviceLogger.warn("Failed to parse timestamp, using current time", { timestamp: raw });
    return new Date();
  }

  return d;
}

function roundToSeconds(d: Date): Date {
  const copy = new Date(d.getTime());
  copy.setMilliseconds(0);
  return copy;
}

export async function upsertAttendanceFromBiometric(args: {
  prisma: any;
  member: any;
  deviceUserId: number;
  logItem: DeviceAttendancePayload;
}): Promise<{
  ipcEvent: "attendance:checkin";
  attendance: any;
}> {
  const { prisma, member, logItem, deviceUserId } = args;

  const now = roundToSeconds(new Date());

  // Device logs can contain duplicates; normalize the computed check-in time.
  const checkInTime = roundToSeconds(getAttendanceTimestamp(logItem));

  deviceLogger.info("Processing attendance log", {
    deviceUserId,
    memberId: member.id,
    checkInTime: checkInTime.toISOString(),
  });

  // Prevent duplicate check-in within 1 second (for biometric scans)
  const nearDuplicate = await prisma.attendance.findFirst({
    where: {
      memberId: member.id,
      checkInTime: {
        gte: new Date(checkInTime.getTime() - 1000),
        lte: new Date(checkInTime.getTime() + 1000),
      },
      method: "BIOMETRIC",
    },
  });

  if (nearDuplicate) {
    deviceLogger.info("Near-duplicate check-in skipped", {
      deviceUserId,
      memberId: member.id,
    });
    return { ipcEvent: "attendance:checkin", attendance: nearDuplicate };
  }

  // Always create a new check-in record (check-in only mode)
  const created = await prisma.attendance.create({
    data: {
      memberId: member.id,
      checkInTime,
      method: "BIOMETRIC",
    },
  });

  deviceLogger.info("Attendance checked in", {
    deviceUserId,
    memberId: member.id,
    checkInTime: checkInTime.toISOString(),
  });

  return { ipcEvent: "attendance:checkin", attendance: created };
}