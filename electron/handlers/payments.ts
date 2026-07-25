export function registerPaymentsHandlers(ipcMain: any, prisma: any) {
  ipcMain.handle('payments:getAll', async () => {
    return await prisma.payment.findMany({
      include: {
        member: { select: { id: true, firstName: true, lastName: true, phone: true } }
      },
      orderBy: { paymentDate: 'desc' },
      take: 5000,
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
