import { deviceManager } from "./DeviceManager";
import type { DeviceAttendancePayload, DeviceUserPayload } from "./types";
import { deviceLogger } from "./DeviceLogger";
import { validateMembershipStateFromMember } from "./membership/validateMembershipStateFromMember";
import { validateCheckIn } from "./membership/validateCheckIn";
import { upsertAttendanceFromBiometric } from "./membership/upsertAttendanceFromBiometric";
import { upsertTrainerAttendanceFromBiometric } from "./membership/upsertTrainerAttendanceFromBiometric";
import type { BrowserWindow } from "electron";

export function registerDeviceAttendanceBridge(args: {
  prisma: any;
  getMemberByDeviceUserId: (deviceUserId: number) => Promise<any | null>;
  getTrainerByDeviceUserId: (deviceUserId: number) => Promise<any | null>;
  getMainWindow: () => BrowserWindow | null;
  log?: (msg: string, meta?: any) => void;
}) {
  const { prisma, getMemberByDeviceUserId, getTrainerByDeviceUserId, getMainWindow, log } = args;

  const sendToRenderer = (channel: string, data: any) => {
    getMainWindow()?.webContents.send(channel, data);
  };

  /**
   * Fetch a single device user by their deviceUserId from the fingerprint device.
   * Returns null if not found or device is unreachable.
   */
  async function fetchDeviceUser(deviceUserId: number): Promise<DeviceUserPayload | null> {
    try {
      const users = await deviceManager.getUsers();
      return users.find((u: any) => {
        const uid = String(u.user_id ?? u.uid ?? u.userId ?? u.id ?? u.employeeNo ?? u.userid);
        return uid === String(deviceUserId);
      }) ?? null;
    } catch (err) {
      deviceLogger.error("Failed to fetch device user for auto-sync", {
        deviceUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Fetch full member with plan/trainer relations for richer UI events
   */
  async function fetchFullMember(memberId: string): Promise<any | null> {
    try {
      return await prisma.member.findUnique({
        where: { id: memberId },
        include: { plan: true, trainer: true },
      });
    } catch {
      return null;
    }
  }

  /**
   * Auto-create a member from device user data when the device has the user
   * but the local database doesn't.
   */
  async function autoCreateMemberFromDevice(deviceUserId: number, deviceUser: DeviceUserPayload): Promise<any | null> {
    try {
      const name = deviceUser.name ?? deviceUser.fullName ?? deviceUser.firstName ?? `Member-${deviceUserId}`;
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || `Member-${deviceUserId}`;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

      const member = await prisma.member.create({
        data: {
          firstName,
          lastName,
          employeeNo: deviceUserId,
          deviceSynced: true,
          status: "ACTIVE",
        },
      });

      deviceLogger.info("Auto-created member from device sync", {
        memberId: member.id,
        deviceUserId,
        name,
      });

      sendToRenderer("member:auto-created", {
        member,
        deviceUserId,
        deviceName: name,
      });

      return member;
    } catch (err) {
      deviceLogger.error("Failed to auto-create member", {
        deviceUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Auto-create a trainer from device user data when the device has the user
   * but the local database doesn't.
   */
  async function autoCreateTrainerFromDevice(deviceUserId: number, deviceUser: DeviceUserPayload): Promise<any | null> {
    try {
      const name = deviceUser.name ?? deviceUser.fullName ?? deviceUser.firstName ?? `Trainer-${deviceUserId}`;
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || `Trainer-${deviceUserId}`;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

      const trainer = await prisma.trainer.create({
        data: {
          firstName,
          lastName,
          employeeNo: deviceUserId,
          deviceSynced: true,
        },
      });

      deviceLogger.info("Auto-created trainer from device sync", {
        trainerId: trainer.id,
        deviceUserId,
        name,
      });

      sendToRenderer("trainer:auto-created", {
        trainer,
        deviceUserId,
        deviceName: name,
      });

      return trainer;
    } catch (err) {
      deviceLogger.error("Failed to auto-create trainer", {
        deviceUserId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  deviceManager.on("attendance", async (newLogs: DeviceAttendancePayload[], silent: boolean = false) => {
    try {
      for (const logItem of newLogs) {
        const deviceUserIdRaw =
          logItem.user_id ?? logItem.userId ?? logItem.deviceUserId ?? logItem.uid ?? null;
        const deviceUserId =
          deviceUserIdRaw == null ? null : Number(deviceUserIdRaw);

        if (!deviceUserId || Number.isNaN(deviceUserId)) {
          // Always send unknown events to renderer (even during startup sync)
          // so operators can see which scans couldn't be matched
          sendToRenderer("attendance:unknown", {
            reason: "missing-device-user-id",
            deviceUserId: deviceUserIdRaw,
            deviceLog: logItem,
            startupSync: silent,
          });
          continue;
        }

        // ─── Check if this is a trainer or member ───
        let trainer = await getTrainerByDeviceUserId(deviceUserId);
        let member = !trainer ? await getMemberByDeviceUserId(deviceUserId) : null;

        // Auto-sync: if user not in DB but exists on device, create them based on device role
        if (!trainer && !member) {
          const deviceUser = await fetchDeviceUser(deviceUserId);
          if (deviceUser) {
            const isTrainerRole = (deviceUser.role !== undefined && deviceUser.role > 0) ||
              (deviceUser.privilege !== undefined && deviceUser.privilege > 0);
            if (isTrainerRole) {
              trainer = await autoCreateTrainerFromDevice(deviceUserId, deviceUser);
            } else {
              member = await autoCreateMemberFromDevice(deviceUserId, deviceUser);
            }
          }
        }

        if (!trainer && !member) {
          // Send unknown event even during startup sync
          sendToRenderer("attendance:unknown", {
            deviceUserId,
            deviceLog: logItem,
            startupSync: silent,
          });
          continue;
        }

        if (trainer) {
          if (!trainer.deviceSynced) {
            try {
              trainer = await prisma.trainer.update({
                where: { id: trainer.id },
                data: { deviceSynced: true }
              });
              sendToRenderer("trainer:updated", trainer);
            } catch (err) {
              deviceLogger.warn("Failed to auto-sync trainer", err);
            }
          }

          const result = await upsertTrainerAttendanceFromBiometric({
            prisma,
            trainer,
            deviceUserId,
            logItem,
          });

          if (result.ignored) {
            sendToRenderer("attendance:ignored", {
              trainer,
              deviceUserId,
              attendance: result.attendance,
              deviceLog: logItem,
              startupSync: silent,
              reason: "4_hour_rule",
            });
            continue;
          }

          // Always send attendance events to renderer (for startup sync and real-time)
          sendToRenderer(result.ipcEvent, {
            trainer,
            deviceUserId,
            attendance: result.attendance,
            deviceLog: logItem,
            startupSync: silent,
          });

          deviceLogger.info("Trainer attendance bridged", {
            ipcEvent: result.ipcEvent,
            trainerId: trainer.id,
            deviceUserId,
            startupSync: silent,
          });
          continue;
        }

        // ─── Regular member flow ───
        if (!member) continue;

        if (!member.deviceSynced) {
          try {
            member = await prisma.member.update({
              where: { id: member.id },
              data: { deviceSynced: true }
            });
            sendToRenderer("member:updated", member);
          } catch (err) {
            deviceLogger.warn("Failed to auto-sync member", err);
          }
        }

        const state = validateMembershipStateFromMember(member);
        const checkInValidation = validateCheckIn(member);

        if (!checkInValidation.allowed) {
          // Fetch full member with plan/trainer relations so the renderer can show rich UI
          const fullMember = await fetchFullMember(member.id);

          if (state === "EXPIRED") {
            sendToRenderer("attendance:expired", {
              member: fullMember || member,
              memberId: member.id,
              deviceUserId,
              state,
              reason: checkInValidation.reason,
              deviceLog: logItem,
              startupSync: silent,
            });
          } else {
            sendToRenderer("attendance:inactive", {
              member: fullMember || member,
              memberId: member.id,
              deviceUserId,
              state,
              reason: checkInValidation.reason,
              deviceLog: logItem,
              startupSync: silent,
            });
          }
          continue;
        }

        const result = await upsertAttendanceFromBiometric({
          prisma,
          member,
          deviceUserId,
          logItem,
        });

        if (result.ignored) {
          const fullMember = await fetchFullMember(member.id);
          sendToRenderer("attendance:ignored", {
            member: fullMember || member,
            deviceUserId,
            attendance: result.attendance,
            deviceLog: logItem,
            startupSync: silent,
            reason: "4_hour_rule",
          });
          continue;
        }

        // Always send attendance events to renderer (for startup sync and real-time)
        sendToRenderer(result.ipcEvent, {
          member,
          deviceUserId,
          attendance: result.attendance,
          membershipState: state,
          deviceLog: logItem,
          startupSync: silent,
        });

        deviceLogger.info("Attendance bridged", {
          ipcEvent: result.ipcEvent,
          memberId: member.id,
          deviceUserId,
          startupSync: silent,
        });
      }
    } catch (error: any) {
      deviceLogger.error("DeviceAttendanceBridge failed", {
        error: error?.message,
      });
      log?.("DeviceAttendanceBridge failed", { error: error?.message });
    }
  });

  deviceManager.on("status", (status) => {
    try {
      sendToRenderer("device:status", status);
    } catch { }
  });
}