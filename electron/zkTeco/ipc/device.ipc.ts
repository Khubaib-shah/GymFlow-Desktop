import type { IpcMain } from 'electron';
import { deviceManager } from '../DeviceManager';
import { deviceSettingsStore } from '../DeviceSettings';
import { createStructuredError } from '../utils';

export function registerZkTecoDeviceHandlers(ipcMain: IpcMain, prisma: any, getMainWindow: () => any) {
  ipcMain.handle('device:get-settings', async () => {
    return { success: true, data: deviceManager.getSettings() };
  });

  ipcMain.handle('device:save-settings', async (_event, settings: any) => {
    try {
      const saved = await deviceManager.applySettings(settings);
      await deviceManager.disconnect();
      if (saved.enabled && saved.ip) {
        deviceManager.startAutoLifecycle();
      }
      return { success: true, data: saved };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:get-status', async () => {
    const settings = deviceManager.getSettings();
    if (!settings.enabled || !settings.ip) {
      return { success: true, data: { connected: false, status: 'offline', message: 'Device is disabled or not configured' } };
    }
    return { success: true, data: deviceManager.getStatus() };
  });

  ipcMain.handle('device:test-connection', async () => {
    try {
      const result = await deviceManager.testConnection();
      const success = Boolean(result && result.connected);
      return { success, data: result, error: success ? undefined : result.message };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:get-users', async () => {
    try {
      const users = await deviceManager.getUsers();
      return { success: true, data: users };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:get-attendance', async () => {
    try {
      const attendance = await deviceManager.getAttendance();
      return { success: true, data: attendance };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:add-user', async (_event, payload: any) => {
    try {
      await deviceManager.addUser(payload);
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:update-user', async (_event, payload: any) => {
    try {
      await deviceManager.updateUser(payload);
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:delete-user', async (_event, userId: number) => {
    try {
      await deviceManager.deleteUser(userId);
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:clear-attendance', async () => {
    try {
      await deviceManager.clearAttendance();
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:restart', async () => {
    try {
      await deviceManager.restartDevice();
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:connect', async () => {
    try {
      const status = await deviceManager.connect();
      return { success: true, data: status };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:disconnect', async () => {
    try {
      await deviceManager.disconnect();
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:reconnect', async () => {
    try {
      const status = await deviceManager.reconnect();
      return { success: true, data: status };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:listen', async () => {
    try {
      deviceManager.startAutoLifecycle();
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:stopListen', async () => {
    try {
      await deviceManager.disconnect();
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:get-config', async () => {
    return { success: true, data: deviceManager.getSettings() };
  });

  ipcMain.handle('device:configure', async (_event, settings: any) => {
    try {
      const saved = await deviceManager.applySettings(settings);
      return { success: true, data: saved };
    } catch (error) {
      return createStructuredError(error);
    }
  });
}
