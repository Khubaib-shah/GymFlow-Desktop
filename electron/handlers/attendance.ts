
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
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
    
    // Clean up stale sessions (> 6 hours) automatically
    const staleSessions = await prisma.attendance.findMany({
      where: { memberId, checkOutTime: null, checkInTime: { lt: sixHoursAgo } }
    });
    
    for (const session of staleSessions) {
      const autoCheckOutTime = new Date(session.checkInTime);
      autoCheckOutTime.setHours(autoCheckOutTime.getHours() + 6);
      await prisma.attendance.update({
        where: { id: session.id },
        data: { checkOutTime: autoCheckOutTime }
      });
    }

    return await prisma.attendance.findFirst({
      where: { memberId, checkOutTime: null, checkInTime: { gte: sixHoursAgo } },
      orderBy: { checkInTime: 'desc' }
    });
  });

  ipcMain.handle('attendance:manualEntry', async (_: any, memberId: string) => {
    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new Error("Member not found");

    const validation = validateCheckIn(member);
    if (!validation.allowed) {
      throw new Error(validation.reason || "Check-in not allowed");
    }

    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
    
    // Check if there's an active session
    const activeSession = await prisma.attendance.findFirst({
      where: { memberId, checkOutTime: null, checkInTime: { gte: sixHoursAgo } },
      orderBy: { checkInTime: 'desc' }
    });

    if (activeSession) {
      // Check Out
      return await prisma.attendance.update({
        where: { id: activeSession.id },
        data: { checkOutTime: new Date() }
      });
    } else {
      // Check In
      return await prisma.attendance.create({
        data: {
          memberId,
          checkInTime: new Date(),
          method: 'MANUAL'
        }
      });
    }
  });
}
