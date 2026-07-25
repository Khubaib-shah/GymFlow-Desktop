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

  ipcMain.handle('device:sync-user', async (_event, employeeNo: number) => {
    try {
      const deviceUsers = await deviceManager.getUsers();

      const deviceUser = deviceUsers.find((u: any) => 
        String(u.user_id ?? u.userId ?? u.uid ?? u.employeeNo) === String(employeeNo)
      );

      if (!deviceUser) {
        return { success: false, error: `User with ID ${employeeNo} not found on device` };
      }

      const isTrainerRole = (deviceUser.role !== undefined && deviceUser.role > 0) || 
                            (deviceUser.privilege !== undefined && deviceUser.privilege > 0);

      let localId: string | null = null;
      if (isTrainerRole) {
        const existing = await prisma.trainer.findFirst({ where: { employeeNo } });
        if (existing) localId = existing.id;
      } else {
        const existing = await prisma.member.findFirst({ where: { employeeNo } });
        if (existing) localId = existing.id;
      }

      if (localId && deviceUser.uid != null) {
        const deviceUid = deviceUser.uid;
        const userTemplates = await deviceManager.getUserTemplates(employeeNo, deviceUid);
        const activeFids = userTemplates.map(t => t.fid);
        
        // Delete fingerprints for this user in the local DB that no longer exist on the device
        await prisma.fingerprint.deleteMany({
          where: {
            uid: deviceUid,
            fid: { notIn: activeFids }
          }
        });

        for (const t of userTemplates) {
          const fpUid = t.uid ?? deviceUid;
          const existingFp = await prisma.fingerprint.findFirst({
            where: { uid: fpUid, fid: t.fid }
          });
          if (!existingFp) {
            await prisma.fingerprint.create({
              data: {
                uid: fpUid,
                fid: t.fid,
                valid: t.valid ?? 1,
                template: t.template,
                size: t.size ?? t.template?.length ?? 0,
                memberId: isTrainerRole ? null : localId,
                trainerId: isTrainerRole ? localId : null,
              }
            });
          }
        }
      }

      return { success: true };
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

  ipcMain.handle('device:delete-finger', async (_event, employeeNo: number, fid: number) => {
    try {
      const user = await prisma.member.findFirst({ where: { employeeNo } }) || 
                   await prisma.trainer.findFirst({ where: { employeeNo } });
      
      let uid: number | undefined;

      if (user) {
        const fingerprint = await prisma.fingerprint.findFirst({
          where: {
            fid,
            OR: [
              { memberId: user.id },
              { trainerId: user.id }
            ]
          }
        });

        if (fingerprint) {
          uid = fingerprint.uid;
        }
      }

      if (uid === undefined) {
        throw new Error("Could not find the internal device UID for this fingerprint. Please re-sync the user from the device first.");
      }

      await deviceManager.deleteFinger(uid, fid);
      
      // Delete the corresponding fingerprint from the local Prisma database
      const fingerprintToDelete = await prisma.fingerprint.findFirst({
        where: { uid, fid }
      });

      if (fingerprintToDelete) {
        await prisma.fingerprint.delete({ where: { id: fingerprintToDelete.id } });
      }

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

  ipcMain.handle('device:start-enrollment', async (_event, userId: number, fingerIndex: number = 0) => {
    try {
      await deviceManager.startEnrollment(userId, fingerIndex);
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

  /**
   * Sync all device users to the local database.
   * For each user on the device, if they don't exist in the DB, create them.
   * Returns counts of created members and trainers.
   */
  ipcMain.handle('device:mark-enrolled', async (_event, employeeNo: number) => {
    try {
      // Find the user (either member or trainer)
      const member = await prisma.member.findFirst({ where: { employeeNo } });
      const trainer = await prisma.trainer.findFirst({ where: { employeeNo } });

      if (member) {
        const existing = await prisma.fingerprint.findFirst({ where: { memberId: member.id } });
        if (!existing) {
          await prisma.fingerprint.create({
            data: { uid: employeeNo, fid: 0, valid: 1, template: Buffer.from("dummy-template"), size: 14, memberId: member.id }
          });
        }
      } else if (trainer) {
        const existing = await prisma.fingerprint.findFirst({ where: { trainerId: trainer.id } });
        if (!existing) {
          await prisma.fingerprint.create({
            data: { uid: employeeNo, fid: 0, valid: 1, template: Buffer.from("dummy-template"), size: 14, trainerId: trainer.id }
          });
        }
      }

      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:start-enroll', async (_event, employeeNo: number, fingerIndex: number = 0) => {
    try {
      await deviceManager.startEnrollment(employeeNo, fingerIndex);
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  ipcMain.handle('device:sync-users', async () => {
    try {
      const { users: deviceUsers, templates: deviceTemplates } = await deviceManager.getUsersAndTemplates();

      let membersCreated = 0;
      let trainersCreated = 0;
      let membersSkipped = 0;
      let trainersSkipped = 0;
      let templatesSynced = 0;

      for (const deviceUser of deviceUsers) {
        const deviceUserIdRaw = deviceUser.user_id ?? deviceUser.userId ?? deviceUser.uid ?? deviceUser.employeeNo;
        const deviceUserId = deviceUserIdRaw == null ? null : Number(deviceUserIdRaw);
        if (!deviceUserId || Number.isNaN(deviceUserId)) continue;

        const name = deviceUser.name ?? deviceUser.fullName ?? deviceUser.firstName ?? `User-${deviceUserId}`;
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || `User-${deviceUserId}`;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

        let localId: string | null = null;
        let isTrainer = false;

        const isTrainerRole = (deviceUser.role !== undefined && deviceUser.role > 0) || 
                              (deviceUser.privilege !== undefined && deviceUser.privilege > 0);

        if (isTrainerRole) {
          // Trainer range
          isTrainer = true;
          const existing = await prisma.trainer.findFirst({ where: { employeeNo: deviceUserId } });
          if (existing) {
            trainersSkipped++;
            localId = existing.id;
          } else {
            const created = await prisma.trainer.create({
              data: { firstName, lastName, employeeNo: deviceUserId, deviceSynced: true },
            });
            trainersCreated++;
            localId = created.id;
          }
        } else {
          // Member range
          isTrainer = false;
          const existing = await prisma.member.findFirst({ where: { employeeNo: deviceUserId } });
          if (existing) {
            membersSkipped++;
            localId = existing.id;
          } else {
            const created = await prisma.member.create({
              data: { firstName, lastName, employeeNo: deviceUserId, deviceSynced: true, status: "ACTIVE" },
            });
            membersCreated++;
            localId = created.id;
          }
        }

        // Sync templates for this user
        if (localId && deviceUser.uid != null) {
          const userTemplates = deviceTemplates.filter(t => t.uid === deviceUser.uid);
          for (const t of userTemplates) {
             const existingFp = await prisma.fingerprint.findFirst({
               where: { uid: t.uid, fid: t.fid }
             });
             if (!existingFp) {
               await prisma.fingerprint.create({
                 data: {
                   uid: t.uid,
                   fid: t.fid,
                   valid: t.valid ?? 1,
                   template: t.template,
                   size: t.size ?? t.template?.length ?? 0,
                   memberId: isTrainer ? null : localId,
                   trainerId: isTrainer ? localId : null,
                 }
               });
               templatesSynced++;
             }
          }
        }
      }

      return {
        success: true,
        data: {
          totalOnDevice: deviceUsers.length,
          membersCreated,
          trainersCreated,
          membersSkipped,
          trainersSkipped,
          templatesSynced,
        },
      };
    } catch (error) {
      return createStructuredError(error);
    }
  });

  /**
   * Sync all existing attendance records from the device.
   * This is called after the app starts to fetch attendance that was recorded
   * while the application was closed.
   * Uses the syncAttendance method which properly filters out already-seen logs.
   */
  ipcMain.handle('device:sync-attendance', async () => {
    return deviceManager.syncAttendance();
  });
}