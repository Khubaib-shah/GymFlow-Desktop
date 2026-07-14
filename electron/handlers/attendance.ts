import { validateCheckIn } from '../zkTeco/membership/validateCheckIn';

export function registerAttendanceHandlers(ipcMain: any, prisma: any) {
  ipcMain.handle('attendance:getRecent', async (_: any, limit: number = 50) => {
    return await prisma.attendance.findMany({
      take: limit,
      orderBy: { checkInTime: 'desc' },
      include: {
        member: true
      }
    });
  });

  ipcMain.handle('attendance:getAll', async () => {
    return await prisma.attendance.findMany({
      orderBy: { checkInTime: 'desc' },
      include: {
        member: true
      }
    });
  });

  ipcMain.handle('attendance:getActiveSession', async (_: any, memberId: string) => {
    // Check-in only: no active session concept needed
    // Return null to indicate no checkout functionality
    return null;
  });

  ipcMain.handle('attendance:manualEntry', async (_: any, memberId: string) => {
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new Error("Member not found");

    const validation = validateCheckIn(member);
    if (!validation.allowed) {
      throw new Error(validation.reason || "Check-in not allowed");
    }

    // Always create a new check-in record (check-in only mode)
    return await prisma.attendance.create({
      data: {
        memberId,
        checkInTime: new Date(),
        method: 'MANUAL'
      }
    });
  });
}