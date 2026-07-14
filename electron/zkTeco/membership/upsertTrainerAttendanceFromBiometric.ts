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

    if (raw == null) {
        deviceLogger.warn("No timestamp found in log item, using current time", { logItem });
        return new Date();
    }

    // Handle different timestamp formats
    let d: Date;

    // If it's a number, it might be Unix timestamp (seconds or milliseconds)
    if (typeof raw === 'number') {
        // If the number is small (< 10^10), it's probably seconds since epoch
        const ms = raw < 10000000000 ? raw * 1000 : raw;
        d = new Date(ms);
    } else if (typeof raw === 'string') {
        // Try parsing as ISO string or other formats
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

    const now = roundToSeconds(new Date());

    const checkInTime = roundToSeconds(getAttendanceTimestamp(logItem));

    deviceLogger.info("Processing trainer attendance log", {
        deviceUserId,
        trainerId: trainer.id,
        checkInTime: checkInTime.toISOString(),
        rawTimestamp: logItem.timestamp ?? (logItem as any).attTime,
    });

    // Prevent duplicate check-in within 1 second (for biometric scans)
    const nearDuplicate = await prisma.trainerAttendance.findFirst({
        where: {
            trainerId: trainer.id,
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
            trainerId: trainer.id,
        });
        return { ipcEvent: "trainerAttendance:checkin", attendance: nearDuplicate };
    }

    // Always create a new check-in record (check-in only mode)
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