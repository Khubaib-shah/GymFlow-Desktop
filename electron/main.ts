import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
// Catch uncaught exceptions in the main process to avoid hard crashes from third-party libs
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception in main process:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection in main process:', reason);
});
import { registerAuthHandlers } from './handlers/auth';
import { registerMembersHandlers } from './handlers/members';
import { registerTrainersHandlers } from './handlers/trainers';
import { registerPlansHandlers } from './handlers/plans';
import { registerAttendanceHandlers } from './handlers/attendance';
import { registerTrainerAttendanceHandlers } from './handlers/trainerAttendance';
import { registerPaymentsHandlers } from './handlers/payments';
import { registerSystemHandlers } from './handlers/system';
import { registerZkTecoDeviceHandlers, deviceManager, registerDeviceAttendanceBridge } from './zkTeco';

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

/** Getter so handlers always have the current mainWindow reference */
function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

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

  // Register all IPC handlers (use getter for mainWindow so it's never stale)
  registerAuthHandlers(ipcMain, prisma);
  registerMembersHandlers(ipcMain, prisma, app.getPath('userData'));
  registerTrainersHandlers(ipcMain, prisma);
  registerPlansHandlers(ipcMain, prisma);
  registerAttendanceHandlers(ipcMain, prisma);
  registerTrainerAttendanceHandlers(ipcMain, prisma);
  registerPaymentsHandlers(ipcMain, prisma);
  registerSystemHandlers(ipcMain, dbPath, prisma);
  registerZkTecoDeviceHandlers(ipcMain, prisma, getMainWindow);

  const getMemberByDeviceUserId = async (deviceUserId: number) => {
    return await prisma.member.findFirst({
      where: { employeeNo: deviceUserId }
    });
  };

  const getTrainerByDeviceUserId = async (deviceUserId: number) => {
    return await prisma.trainer.findFirst({
      where: { employeeNo: deviceUserId }
    });
  };

  // Provide Prisma instance to DeviceManager for persistent dedup tracking
  deviceManager.setPrismaClient(prisma);

  registerDeviceAttendanceBridge({
    prisma,
    getMemberByDeviceUserId,
    getTrainerByDeviceUserId,
    getMainWindow,
  });

  // Create window AFTER registering handlers
  createWindow();

  const settings = deviceManager.getSettings();
  if (settings.enabled && settings.ip) {
    deviceManager.startAutoLifecycle();

    // Perform initial attendance sync after the window is ready
    // This catches attendance recorded while the app was closed
    setTimeout(async () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        await deviceManager.syncAttendance();
      }
    }, 2000); // Wait 2 seconds for renderer to be ready
  }

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

// Cleanup on quit to prevent SQLite locks, device socket leaks, and orphaned timers
app.on('before-quit', async () => {
  try {
    deviceManager.disconnect();
  } catch {
    // ignore cleanup errors
  }
  try {
    await prisma.$disconnect();
  } catch {
    // ignore cleanup errors
  }
});