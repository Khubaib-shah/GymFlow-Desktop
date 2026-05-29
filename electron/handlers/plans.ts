export function registerPlansHandlers(ipcMain: any, prisma: any) {
  ipcMain.handle('plans:getAll', async () => {
    return await prisma.membershipPlan.findMany({
      orderBy: { price: 'asc' }
    });
  });

  ipcMain.handle('plans:create', async (_, data: any) => {
    return await prisma.membershipPlan.create({
      data
    });
  });

  ipcMain.handle('plans:update', async (_, id: string, data: any) => {
    return await prisma.membershipPlan.update({
      where: { id },
      data
    });
  });

  ipcMain.handle('plans:delete', async (_, id: string) => {
    return await prisma.membershipPlan.delete({
      where: { id }
    });
  });
}
