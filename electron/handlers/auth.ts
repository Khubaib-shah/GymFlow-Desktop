import bcrypt from 'bcryptjs';

export function registerAuthHandlers(ipcMain: any, prisma: any) {
  ipcMain.handle('auth:checkHasOwner', async () => {
    const count = await prisma.owner.count();
    return count > 0;
  });

  ipcMain.handle('auth:createInitialOwner', async (_, data: any) => {
    const count = await prisma.owner.count();
    if (count > 0) throw new Error('Owner already exists');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    return await prisma.owner.create({
      data: {
        username: data.username,
        password: hashedPassword,
      }
    });
  });

  ipcMain.handle('auth:login', async (_, credentials: any) => {
    const owner = await prisma.owner.findUnique({
      where: { username: credentials.username }
    });

    if (!owner) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(credentials.password, owner.password);
    if (!valid) throw new Error('Invalid credentials');

    // Remove password before returning
    const { password, ...safeOwner } = owner;
    return safeOwner;
  });
}
