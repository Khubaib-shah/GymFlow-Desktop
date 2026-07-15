import type { DeviceAttendancePayload } from "../types";
import { deviceLogger } from "../DeviceLogger";

function getAttendanceTimestamp(logItem: DeviceAttendancePayload): Date {
    const raw =
        logItem.timestamp ??
        (logItem as any).attTime ??
        (logItem as any).checkInTime ??
        (logItem as any).checkTime ??
        (logItem as any).date;

    if (raw == null) {
        deviceLogger.warn("No timestamp found in log item, using current time", { logItem });
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
        deviceLogger.warn("Failed to parse timestamp, using current time", { timestamp: raw, logItem });
        return new Date();
    }

    return d;
}

function roundToSeconds(d: Date): Date {
    const copy = new Date(d.getTime());
    copy.setMilliseconds(0);
    return copy;
}

export async function upsertTrainerAttendanceFromBiometric(args: {
    prisma: any;
    trainer: any;
    deviceUserId: number;
    logItem: DeviceAttendancePayload;
}): Promise<{
    ipcEvent: "trainerAttendance:checkin";
    attendance: any;
}> {
    const { prisma, trainer, logItem, deviceUserId } = args;

    const checkInTime = roundToSeconds(getAttendanceTimestamp(logItem));

    deviceLogger.info("Processing trainer attendance log", {
        deviceUserId,
        trainerId: trainer.id,
        checkInTime: checkInTime.toISOString(),
    });

    // Prevent duplicate: check for existing record with exact (trainerId, checkInTime, method)
    const existing = await prisma.trainerAttendance.findFirst({
        where: {
            trainerId: trainer.id,
            checkInTime,
            method: "BIOMETRIC",
        },
    });

    if (existing) {
        deviceLogger.info("Duplicate trainer check-in skipped (exact match)", {
            deviceUserId,
            trainerId: trainer.id,
            attendanceId: existing.id,
        });
        return { ipcEvent: "trainerAttendance:checkin", attendance: existing };
    }

    const created = await prisma.trainerAttendance.create({
        data: {
            trainerId: trainer.id,
            checkInTime,
            method: "BIOMETRIC",
        },
    });

    deviceLogger.info("Trainer attendance checked in", {
        deviceUserId,
        trainerId: trainer.id,
        checkInTime: checkInTime.toISOString(),
    });

    return { ipcEvent: "trainerAttendance:checkin", attendance: created };
}
