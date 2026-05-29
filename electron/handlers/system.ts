import { app, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

export function registerSystemHandlers(ipcMain: any, dbPath: string) {
  ipcMain.handle('system:backupDb', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: 'No focused window' };

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Backup Database',
      defaultPath: `gms_backup_${new Date().toISOString().split('T')[0]}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    });

    if (canceled || !filePath) return { success: false, error: 'User canceled' };

    try {
      fs.copyFileSync(dbPath, filePath);
      return { success: true, filePath };
    } catch (error: any) {
      console.error('Backup error:', error);
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
      fs.copyFileSync(filePaths[0], dbPath);
      app.relaunch();
      app.exit(0);
      return { success: true };
    } catch (error: any) {
      console.error('Restore error:', error);
      return { success: false, error: error.message };
    }
  });

  // One-click reset: wipes all data from every table without needing a file picker.
  ipcMain.handle('system:resetDb', async () => {
    try {
      const isDev = !app.isPackaged;

      if (isDev) {
        // In development: use the sqlite3 module to delete all rows from each table
        const sqlite3 = require('sqlite3').verbose();
        const db = new sqlite3.Database(dbPath);
        await new Promise<void>((resolve, reject) => {
          db.serialize(() => {
            db.run('PRAGMA foreign_keys = OFF');
            const tables = ['Payment', 'Attendance', 'Member', 'Trainer', 'MembershipPlan', 'Owner'];
            for (const table of tables) {
              db.run(`DELETE FROM "${table}"`);
            }
            db.run('PRAGMA foreign_keys = ON', (err: any) => {
              if (err) reject(err); else resolve();
            });
          });
        });
        db.close();
        return { success: true };
      } else {
        // In production: overwrite the user db with the pristine seed database, then relaunch
        const pristineDb = path.join(process.resourcesPath, 'dev.db');
        if (!fs.existsSync(pristineDb)) {
          return { success: false, error: 'Pristine database not found in app resources.' };
        }
        fs.copyFileSync(pristineDb, dbPath);
        app.relaunch();
        app.exit(0);
        return { success: true };
      }
    } catch (error: any) {
      console.error('Reset DB error:', error);
      return { success: false, error: error.message };
    }
  });
}
