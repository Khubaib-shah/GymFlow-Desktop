import { ipcMain } from "electron";
import { deviceManager } from "./DeviceManager";
import type { DeviceAttendancePayload } from "./types";
import { deviceLogger } from "./DeviceLogger";
import { validateMembershipStateFromMember } from "./membership/validateMembershipStateFromMember";
import { upsertAttendanceFromBiometric } from "./membership/upsertAttendanceFromBiometric";

// Note: this module is electron-main only.
// It bridges device polling events (DeviceManager) into renderer-friendly IPC events.

export function registerDeviceAttendanceBridge(args: {
  prisma: any;
  getMemberByDeviceUserId: (deviceUserId: number) => Promise<any | null>;
  emitToMain: typeof ipcMain;
  log?: (msg: string, meta?: any) => void;
}) {
  const { prisma, getMemberByDeviceUserId, emitToMain, log } = args;

  // Bridge: deviceManager -> IPC -> renderer
  deviceManager.on("attendance", async (newLogs: DeviceAttendancePayload[]) => {
    try {
      for (const logItem of newLogs) {
        const deviceUserIdRaw =
          logItem.userId ?? logItem.deviceUserId ?? logItem.uid ?? null;
        const deviceUserId =
          deviceUserIdRaw == null ? null : Number(deviceUserIdRaw);

        if (!deviceUserId || Number.isNaN(deviceUserId)) {
          emitToMain.emit("attendance:unknown", {
            reason: "missing-device-user-id",
            deviceUserId: deviceUserIdRaw,
            deviceLog: logItem,
          });
          continue;
        }

        const member = await getMemberByDeviceUserId(deviceUserId);

        if (!member) {
          emitToMain.emit("attendance:unknown", {
            deviceUserId,
            deviceLog: logItem,
          });
          continue;
        }

        // Determine membership state
        const state = validateMembershipStateFromMember(member);

        if (state === "BLOCKED") {
          emitToMain.emit("attendance:inactive", {
            memberId: member.id,
            deviceUserId,
            state,
            deviceLog: logItem,
          });
          continue;
        }

        // Save attendance (check-in/out) and emit event type
        const result = await upsertAttendanceFromBiometric({
          prisma,
          member,
          deviceUserId,
          logItem,
        });

        emitToMain.emit(result.ipcEvent, {
          member,
          deviceUserId,
          attendance: result.attendance,
          membershipState: state,
          deviceLog: logItem,
        });

        deviceLogger.info("Attendance bridged", {
          ipcEvent: result.ipcEvent,
          memberId: member.id,
          deviceUserId,
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
      emitToMain.emit("device:status", status);
    } catch {}
  });
}
