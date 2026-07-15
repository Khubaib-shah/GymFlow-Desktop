import { app, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { deviceManager } from '../zkTeco/DeviceManager';

export function registerSystemHandlers(ipcMain: any, dbPath: string, prisma: PrismaClient) {
  ipcMain.handle('system:backupDb', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: 'No focused window' };

    const { canceled, filePath: savePath } = await dialog.showSaveDialog(win, {
      title: 'Backup Database',
      defaultPath: `gms_backup_${new Date().toISOString().split('T')[0]}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (canceled || !savePath) return { success: false, error: 'User canceled' };

    try {
      await prisma.$disconnect();
      fs.copyFileSync(dbPath, savePath);
      await prisma.$connect();
      return { success: true, filePath: savePath };
    } catch (error: any) {
      console.error('Backup error:', error);
      await prisma.$connect().catch(() => { });
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('system:getDbPath', () => {
    return dbPath;
  });

  ipcMain.handle('system:restoreDb', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: 'No focused window' };

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Restore Database',
      properties: ['openFile'],
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (canceled || filePaths.length === 0) return { success: false, error: 'User canceled' };

    try {
      await prisma.$disconnect();

      if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
      if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);

      fs.copyFileSync(filePaths[0], dbPath);
      app.relaunch();
      app.quit();
      return { success: true };
    } catch (error: any) {
      console.error('Restore error:', error);
      await prisma.$connect().catch(() => { });
      return { success: false, error: error.message };
    }
  });

  /**
   * Resets the application database to a completely empty state.
   *
   * Deletes all records from all tables in dependency order (child tables first)
   * so that foreign key constraints are satisfied without needing PRAGMA foreign_keys = OFF.
   *
   * Also resets the device settings stored in userData.
   *
   * The biometric device itself is NOT affected.
   */
  ipcMain.handle('system:resetDb', async () => {
    try {
      // Phase 1: Delete all records via Prisma in dependency order.
      // Children first, then parents — this satisfies FK constraints naturally.
      await prisma.trainerAttendance.deleteMany();
      await prisma.attendance.deleteMany();
      await prisma.payment.deleteMany();
      await prisma.member.deleteMany();
      await prisma.membershipPlan.deleteMany();
      await prisma.trainer.deleteMany();
      await prisma.deviceAttendanceLog.deleteMany();
      await prisma.owner.deleteMany();

      // Phase 2: Clear DeviceManager runtime state and stop polling
      deviceManager.clearCache();
      try {
        await deviceManager.disconnect();
      } catch {
        // ignore disconnect errors
      }

      // Phase 3: Reset device settings to defaults
      const { deviceSettingsStore } = require('../zkTeco/DeviceSettings');
      try {
        deviceSettingsStore.save({
          enabled: false,
          ip: '',
          port: 4370,
          timeout: 10000,
          pollInterval: 5000,
        });
      } catch {
        // ignore settings reset errors
      }

      return { success: true };
    } catch (error: any) {
      console.error('Reset DB error:', error);
      return { success: false, error: error.message };
    }
  });
}
