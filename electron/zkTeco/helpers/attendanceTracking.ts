import type { DeviceAttendancePayload } from "../types";
import { deviceLogger } from "../DeviceLogger";

// 4 hours in milliseconds
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Round a Date to second-level precision.
 * ZKTeco device timestamps have second resolution; normalizing to
 * seconds ensures consistent comparisons across different reads.
 */
function roundToSeconds(d: Date): Date {
  const copy = new Date(d.getTime());
  copy.setMilliseconds(0);
  return copy;
}

/**
 * Get a deduplication key from a log that is stable across reads.
 *
 * Strategy (best-effort):
 * 1. If deviceLogId exists, use `id:<logId>` (unique per-device record ID)
 * 2. Otherwise use `combo:<userId>:<roundedTimestamp>` (second-level precision)
 *
 * The key is designed to produce the same value for the same physical
 * attendance event regardless of when or how many times the device is queried.
 */
export function getAttendanceKey(log: DeviceAttendancePayload): string {
    // deviceLogId is the internal record ID from the device (most reliable)
    const logId = log.deviceLogId ?? (log.id != null ? Number(log.id) : null);
    if (logId != null) {
        return `id:${logId}`;
    }
    // Fallback: userId + rounded timestamp
    const userId = log.user_id ?? log.userId ?? log.uid ?? log.deviceUserId ?? "unknown";
    const ts = getAttendanceTimestamp(log);
    const rounded = Number.isNaN(ts.getTime()) ? "?" : String(Math.floor(ts.getTime() / 1000));
    return `combo:${userId}-${rounded}`;
}

export function getAttendanceTimestamp(log: DeviceAttendancePayload): Date {
    let rawTs = log.checkInTime ?? log.record_time ?? log.timestamp ?? log.attTime ?? log.recordTime ?? log.date ?? "";
    return rawTs instanceof Date ? rawTs : new Date(rawTs);
}

/**
 * Check if an attendance record should be created based on the 4-hour rule.
 * Checks the 'attendance' table (for members).
 * Returns true if this is a new check-in (more than 4 hours since last valid check-in).
 */
export async function shouldCreateAttendance(args: {
    prisma: any;
    memberId: string;
    checkInTime: Date;
    method: string;
}): Promise<boolean> {
    const { prisma, memberId, checkInTime, method } = args;

    const lastAttendance = await prisma.attendance.findFirst({
        where: {
            memberId,
            method,
        },
        orderBy: {
            checkInTime: "desc",
        },
    });

    if (!lastAttendance) {
        return true;
    }

    const timeSinceLastCheckIn = checkInTime.getTime() - lastAttendance.checkInTime.getTime();

    if (timeSinceLastCheckIn < FOUR_HOURS_MS) {
        deviceLogger.info("Skipping duplicate check-in within 4 hours", {
            memberId,
            checkInTime: checkInTime.toISOString(),
            lastCheckIn: lastAttendance.checkInTime.toISOString(),
            hoursSinceLast: Math.round(timeSinceLastCheckIn / (60 * 60 * 1000) * 10) / 10,
        });
        return false;
    }

    return true;
}

/**
 * Check if a trainer attendance record should be created based on the 4-hour rule.
 */
export async function shouldCreateTrainerAttendance(args: {
    prisma: any;
    trainerId: string;
    checkInTime: Date;
    method: string;
}): Promise<boolean> {
    const { prisma, trainerId, checkInTime, method } = args;

    const lastAttendance = await prisma.trainerAttendance.findFirst({
        where: {
            trainerId,
            method,
        },
        orderBy: {
            checkInTime: "desc",
        },
    });

    if (!lastAttendance) {
        return true;
    }

    const timeSinceLastCheckIn = checkInTime.getTime() - lastAttendance.checkInTime.getTime();

    if (timeSinceLastCheckIn < FOUR_HOURS_MS) {
        deviceLogger.info("Skipping duplicate trainer check-in within 4 hours", {
            trainerId,
            checkInTime: checkInTime.toISOString(),
            lastCheckIn: lastAttendance.checkInTime.toISOString(),
            hoursSinceLast: Math.round(timeSinceLastCheckIn / (60 * 60 * 1000) * 10) / 10,
        });
        return false;
    }

    return true;
}

/**
 * Record a device attendance log in the persistent tracking table.
 * checkInTime is normalized to second precision for stable dedup.
 */
export async function recordDeviceAttendanceLog(args: {
    prisma: any;
    deviceUserId: number;
    deviceLogId?: number | null;
    checkInTime: Date;
    method: string;
}): Promise<void> {
    const { prisma, deviceUserId, deviceLogId, checkInTime, method } = args;

    // Normalize to seconds for stable dedup across reads
    const normalizedTime = roundToSeconds(checkInTime);
    const finalMethod = method || "BIOMETRIC";

    try {
        if (deviceLogId != null) {
            // Upsert by unique_device_attendance
            await prisma.deviceAttendanceLog.upsert({
                where: {
                    unique_device_attendance: {
                        deviceUserId,
                        deviceLogId,
                    },
                },
                update: {
                    checkInTime: normalizedTime,
                    method: finalMethod,
                },
                create: {
                    deviceUserId,
                    deviceLogId,
                    checkInTime: normalizedTime,
                    method: finalMethod,
                },
            });
        } else {
            // Upsert by unique_device_attendance_time
            await prisma.deviceAttendanceLog.upsert({
                where: {
                    unique_device_attendance_time: {
                        deviceUserId,
                        checkInTime: normalizedTime,
                        method: finalMethod,
                    },
                },
                update: {},
                create: {
                    deviceUserId,
                    deviceLogId: undefined,
                    checkInTime: normalizedTime,
                    method: finalMethod,
                },
            });
        }
    } catch (err: any) {
        deviceLogger.warn("Failed to upsert device attendance log", { error: err.message });
    }
}

/**
 * Check if a device attendance log has already been processed.
 * Uses normalized (second-level) timestamps for reliable matching.
 */
export async function isAttendanceLogProcessed(args: {
    prisma: any;
    deviceUserId: number;
    deviceLogId?: number | null;
    checkInTime: Date;
    method: string;
}): Promise<boolean> {
    const { prisma, deviceUserId, deviceLogId, checkInTime, method } = args;

    const normalizedTime = roundToSeconds(checkInTime);
    const finalMethod = method || "BIOMETRIC";

    // If we have a device log ID, check by that (most reliable)
    if (deviceLogId != null) {
        const existing = await prisma.deviceAttendanceLog.findUnique({
            where: {
                unique_device_attendance: {
                    deviceUserId,
                    deviceLogId,
                },
            },
        });
        if (existing) return true;
    }

    // Otherwise check by the normalized time-based key
    const existing = await prisma.deviceAttendanceLog.findUnique({
        where: {
            unique_device_attendance_time: {
                deviceUserId,
                checkInTime: normalizedTime,
                method: finalMethod,
            },
        },
    });
    
    return !!existing;
}

/**
 * Get the timestamp of the last processed attendance log.
 */
export async function getLastProcessedAttendanceTime(args: {
    prisma: any;
}): Promise<Date | null> {
    const { prisma } = args;

    const lastLog = await prisma.deviceAttendanceLog.findFirst({
        orderBy: {
            checkInTime: "desc",
        },
    });

    return lastLog?.checkInTime ?? null;
}
