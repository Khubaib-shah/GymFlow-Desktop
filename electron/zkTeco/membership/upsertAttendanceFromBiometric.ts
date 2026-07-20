import type { DeviceAttendancePayload } from "../types";
import { deviceLogger } from "../DeviceLogger";
import { validateAttendanceRecord } from "./attendanceValidation";

function getAttendanceTimestamp(logItem: DeviceAttendancePayload): Date {
  let raw =
    (logItem as any).checkInTime ??
    logItem.record_time ??
    logItem.timestamp ??
    (logItem as any).attTime ??
    (logItem as any).checkTime ??
    (logItem as any).recordTime ??
    (logItem as any).date;

  if (raw == null) {
    deviceLogger.warn("No timestamp found in log item, using current time");
    return new Date();
  }

  let d: Date;
  if (typeof raw === 'number') {
    const ms = raw < 10000000000 ? raw * 1000 : raw;
    d = new Date(ms);
  } else if (typeof raw === 'string') {
    d = new Date(raw);
  } else {
    d = new Date(raw);
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
  ignored?: boolean;
}> {
  const { prisma, member, logItem, deviceUserId } = args;

  const checkInTime = roundToSeconds(getAttendanceTimestamp(logItem));

  deviceLogger.info("Processing attendance log", {
    deviceUserId,
    memberId: member.id,
    checkInTime: checkInTime.toISOString(),
  });

  const validation = await validateAttendanceRecord({
    prisma,
    userType: "MEMBER",
    userId: member.id,
    checkInTime,
    deviceUserId,
  });

  if (validation.status !== "valid") {
    return { ipcEvent: "attendance:checkin", attendance: validation.record, ignored: true };
  }

  // Always create a new check-in record
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
