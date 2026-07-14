export function registerTrainerAttendanceHandlers(ipcMain: any, prisma: any) {
  // Get all trainer attendance logs
  ipcMain.handle('trainerAttendance:getAll', async () => {
    return await prisma.trainerAttendance.findMany({
      orderBy: { checkInTime: 'desc' },
      include: { trainer: true }
    });
  });

  // Manual check-in only (no checkout)
  ipcMain.handle('trainerAttendance:manualEntry', async (_: any, trainerId: string) => {
    const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) throw new Error('Trainer not found');

    // Always create a new check-in record (check-in only mode)
    return await prisma.trainerAttendance.create({
      data: { trainerId, checkInTime: new Date(), method: 'MANUAL' }
    });
  });
}