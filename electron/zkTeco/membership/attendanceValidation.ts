import { deviceLogger } from "../DeviceLogger";

export type ValidationResult =
  | { status: "valid" }
  | { status: "duplicate"; record: any }
  | { status: "ignored"; reason: "4_hour_rule"; record: any };

export async function validateAttendanceRecord(args: {
  prisma: any;
  userType: "MEMBER" | "TRAINER";
  userId: string;
  checkInTime: Date;
  deviceUserId: number;
}): Promise<ValidationResult> {
  const { prisma, userType, userId, checkInTime, deviceUserId } = args;

  const model = userType === "MEMBER" ? prisma.attendance : prisma.trainerAttendance;
  const userKey = userType === "MEMBER" ? "memberId" : "trainerId";

  // 1. Exact Duplicate Check
  const existingExact = await model.findFirst({
    where: {
      [userKey]: userId,
      checkInTime,
      method: "BIOMETRIC",
    },
  });

  if (existingExact) {
    deviceLogger.info(`Duplicate ${userType.toLowerCase()} check-in skipped (exact match)`, {
      deviceUserId,
      [userKey]: userId,
      attendanceId: existingExact.id,
    });
    return { status: "duplicate", record: existingExact };
  }

  // 2. 4-Hour Rule Check
  // Temporarily disabled for testing
  /*
  const fourHoursAgo = new Date(checkInTime.getTime() - 4 * 60 * 60 * 1000);
  
  const recentAttendance = await model.findFirst({
    where: {
      [userKey]: userId,
      checkInTime: {
        gte: fourHoursAgo,
        lte: checkInTime,
      },
      method: "BIOMETRIC",
    },
  });

  if (recentAttendance) {
    deviceLogger.info(`Check-in ignored (${userType.toLowerCase()} scanned within 4 hours)`, {
      deviceUserId,
      [userKey]: userId,
      recentAttendanceId: recentAttendance.id,
      recentCheckInTime: recentAttendance.checkInTime.toISOString(),
    });
    return { status: "ignored", reason: "4_hour_rule", record: recentAttendance };
  }
  */

  return { status: "valid" };
}
