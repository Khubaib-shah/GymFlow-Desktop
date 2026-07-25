import bcrypt from 'bcryptjs';

export function registerAuthHandlers(ipcMain: any, prisma: any) {
  ipcMain.handle('auth:checkHasOwner', async () => {
    const count = await prisma.owner.count();
    return count > 0;
  });

  ipcMain.handle('auth:createInitialOwner', async (_: any, data: any) => {
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

  ipcMain.handle('auth:login', async (_: any, credentials: any) => {
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

  const sessionPath = require('path').join(require('electron').app.getPath('userData'), 'session.json');
  const fs = require('fs');

  ipcMain.handle('auth:getSession', async () => {
    try {
      if (fs.existsSync(sessionPath)) {
        const data = fs.readFileSync(sessionPath, 'utf-8');
        return JSON.parse(data).isAuthenticated || false;
      }
    } catch (err) {
      console.error("Failed to read session", err);
    }
    return false;
  });

  ipcMain.handle('auth:setSession', async (_: any, isAuthenticated: boolean) => {
    try {
      fs.writeFileSync(sessionPath, JSON.stringify({ isAuthenticated }));
    } catch (err) {
      console.error("Failed to write session", err);
    }
    return true;
  });
}
