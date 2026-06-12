import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { registerAuthHandlers } from './handlers/auth';
import { registerMembersHandlers } from './handlers/members';
import { registerTrainersHandlers } from './handlers/trainers';
import { registerPlansHandlers } from './handlers/plans';
import { registerAttendanceHandlers } from './handlers/attendance';
import { registerPaymentsHandlers } from './handlers/payments';
import { registerSystemHandlers } from './handlers/system';

// Initialize Prisma client with local database
const isDev = !app.isPackaged;
const dbPath = isDev
  ? path.join(__dirname, '../prisma/dev.db')
  : path.join(app.getPath('userData'), 'database.db');

if (!isDev) {
  if (!fs.existsSync(dbPath)) {
    try {
      // extraResources places dev.db directly in resources path
      const sourceDb = path.join(process.resourcesPath, 'dev.db');
      if (fs.existsSync(sourceDb)) {
        fs.copyFileSync(sourceDb, dbPath);
        console.log('Initial database copied to user data directory.');
      } else {
        console.error('Source dev.db not found in resources:', sourceDb);
      }
    } catch (err) {
      console.error('Failed to copy initial database:', err);
    }
  }
}

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`
    }
  }
});

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
  });

  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built React app
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Ensure user data directory exists
  const mediaDir = path.join(app.getPath('userData'), 'media');
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
  }

  // Register all IPC handlers
  registerAuthHandlers(ipcMain, prisma);
  registerMembersHandlers(ipcMain, prisma, app.getPath('userData'));
  registerTrainersHandlers(ipcMain, prisma);
  registerPlansHandlers(ipcMain, prisma);
  registerAttendanceHandlers(ipcMain, prisma);
  registerPaymentsHandlers(ipcMain, prisma);
  registerSystemHandlers(ipcMain, dbPath, prisma);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
