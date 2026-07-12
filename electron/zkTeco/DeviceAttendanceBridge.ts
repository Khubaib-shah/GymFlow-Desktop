import { deviceManager } from "./DeviceManager";
import type { DeviceAttendancePayload } from "./types";
import { deviceLogger } from "./DeviceLogger";
import { validateMembershipStateFromMember } from "./membership/validateMembershipStateFromMember";
import { validateCheckIn } from "./membership/validateCheckIn";
import { upsertAttendanceFromBiometric } from "./membership/upsertAttendanceFromBiometric";
import type { BrowserWindow } from "electron";

export function registerDeviceAttendanceBridge(args: {
  prisma: any;
  getMemberByDeviceUserId: (deviceUserId: number) => Promise<any | null>;
  getMainWindow: () => BrowserWindow | null;
  log?: (msg: string, meta?: any) => void;
}) {
  const { prisma, getMemberByDeviceUserId, getMainWindow, log } = args;

  const sendToRenderer = (channel: string, data: any) => {
    getMainWindow()?.webContents.send(channel, data);
  };

  deviceManager.on("attendance", async (newLogs: DeviceAttendancePayload[]) => {
    try {
      for (const logItem of newLogs) {
        const deviceUserIdRaw =
          logItem.userId ?? logItem.deviceUserId ?? logItem.uid ?? null;
        const deviceUserId =
          deviceUserIdRaw == null ? null : Number(deviceUserIdRaw);

        if (!deviceUserId || Number.isNaN(deviceUserId)) {
          sendToRenderer("attendance:unknown", {
            reason: "missing-device-user-id",
            deviceUserId: deviceUserIdRaw,
            deviceLog: logItem,
          });
          continue;
        }

        const member = await getMemberByDeviceUserId(deviceUserId);

        if (!member) {
          sendToRenderer("attendance:unknown", {
            deviceUserId,
            deviceLog: logItem,
          });
          continue;
        }

        const state = validateMembershipStateFromMember(member);
        const checkInValidation = validateCheckIn(member);

        if (!checkInValidation.allowed) {
          if (state === "EXPIRED") {
            sendToRenderer("attendance:expired", {
              memberId: member.id,
              deviceUserId,
              state,
              reason: checkInValidation.reason,
              deviceLog: logItem,
            });
          } else {
            sendToRenderer("attendance:inactive", {
              memberId: member.id,
              deviceUserId,
              state,
              reason: checkInValidation.reason,
              deviceLog: logItem,
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

        sendToRenderer(result.ipcEvent, {
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
      sendToRenderer("device:status", status);
    } catch {}
  });
}
