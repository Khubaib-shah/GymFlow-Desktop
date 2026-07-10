export function registerTrainerAttendanceHandlers(ipcMain: any, prisma: any) {
  // Get all trainer attendance logs
  ipcMain.handle('trainerAttendance:getAll', async () => {
    return await prisma.trainerAttendance.findMany({
      orderBy: { checkInTime: 'desc' },
      include: { trainer: true }
    });
  });

  // Check if trainer has an active session (within last 12 hours)
  ipcMain.handle('trainerAttendance:getActiveSession', async (_: any, trainerId: string) => {
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

    // Auto-close stale sessions
    const stale = await prisma.trainerAttendance.findMany({
      where: { trainerId, checkOutTime: null, checkInTime: { lt: twelveHoursAgo } }
    });
    for (const s of stale) {
      const autoOut = new Date(s.checkInTime);
      autoOut.setHours(autoOut.getHours() + 12);
      await prisma.trainerAttendance.update({
        where: { id: s.id },
        data: { checkOutTime: autoOut }
      });
    }

    return await prisma.trainerAttendance.findFirst({
      where: { trainerId, checkOutTime: null, checkInTime: { gte: twelveHoursAgo } },
      orderBy: { checkInTime: 'desc' }
    });
  });

  // Manual check-in / check-out for trainer
  ipcMain.handle('trainerAttendance:manualEntry', async (_: any, trainerId: string) => {
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) throw new Error('Trainer not found');

    const activeSession = await prisma.trainerAttendance.findFirst({
      where: { trainerId, checkOutTime: null, checkInTime: { gte: twelveHoursAgo } },
      orderBy: { checkInTime: 'desc' }
    });

    if (activeSession) {
      return await prisma.trainerAttendance.update({
        where: { id: activeSession.id },
        data: { checkOutTime: new Date() }
      });
    } else {
      return await prisma.trainerAttendance.create({
        data: { trainerId, checkInTime: new Date(), method: 'MANUAL' }
      });
    }
  });
}
