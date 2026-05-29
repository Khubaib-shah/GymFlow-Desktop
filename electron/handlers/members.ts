import path from 'path';

export function registerMembersHandlers(ipcMain: any, prisma: any, userDataPath: string) {
  ipcMain.handle('members:getAll', async () => {
    return await prisma.member.findMany({
      include: {
        trainer: true,
        plan: true
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  ipcMain.handle('members:getById', async (_, id: string) => {
    return await prisma.member.findUnique({
      where: { id },
      include: {
        trainer: true,
        plan: true,
        attendances: {
          orderBy: { checkInTime: 'desc' },
          take: 10
        }
      }
    });
  });

  ipcMain.handle('members:create', async (_, data: any) => {
    return await prisma.member.create({
      data
    });
  });

  ipcMain.handle('members:update', async (_, id: string, data: any) => {
    return await prisma.member.update({
      where: { id },
      data
    });
  });

  ipcMain.handle('members:delete', async (_, id: string) => {
    return await prisma.member.delete({
      where: { id }
    });
  });

  ipcMain.handle('members:getPhotoPath', async (_, filename: string) => {
    return path.join(userDataPath, 'media', filename);
  });
}
