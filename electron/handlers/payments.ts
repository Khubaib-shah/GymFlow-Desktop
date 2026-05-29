export function registerPaymentsHandlers(ipcMain: any, prisma: any) {
  ipcMain.handle('payments:getAll', async () => {
    return await prisma.payment.findMany({
      include: {
        member: true
      },
      orderBy: { paymentDate: 'desc' }
    });
  });

  ipcMain.handle('payments:getByMember', async (_: any, memberId: string) => {
    return await prisma.payment.findMany({
      where: { memberId },
      orderBy: { paymentDate: 'desc' }
    });
  });

  ipcMain.handle('payments:create', async (_: any, data: any) => {
    return await prisma.payment.create({
      data
    });
  });
}
