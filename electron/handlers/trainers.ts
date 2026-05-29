export function registerTrainersHandlers(ipcMain: any, prisma: any) {
  ipcMain.handle('trainers:getAll', async () => {
    return await prisma.trainer.findMany({
      include: {
        _count: {
          select: { members: true }
        },
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            status: true,
            plan: { select: { name: true } }
          },
          orderBy: { firstName: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  ipcMain.handle('trainers:create', async (_, data: any) => {
    return await prisma.trainer.create({
      data
    });
  });

  ipcMain.handle('trainers:update', async (_, id: string, data: any) => {
    return await prisma.trainer.update({
      where: { id },
      data
    });
  });

  ipcMain.handle('trainers:delete', async (_, id: string) => {
    return await prisma.trainer.delete({
      where: { id }
    });
  });
}
