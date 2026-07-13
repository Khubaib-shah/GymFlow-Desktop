import ZKLib from "node-zklib";
import type {
  DeviceInfoPayload,
  DeviceAttendancePayload,
  DeviceUserPayload,
} from "./types";
import { deviceLogger } from "./DeviceLogger";
import { COMMANDS } from "./constants";

export class ZKClient {
  private client: any = null;
  private commandQueue: (() => Promise<any>)[] = [];
  private isProcessing = false;

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.commandQueue.length > 0) {
      const cmd = this.commandQueue.shift();
      if (cmd) {
        try {
          await cmd();
        } catch (err) {
          // already handled in each command's catch block
        }
      }
    }

    this.isProcessing = false;
  }

  private queueCommand<T>(cmd: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push(async () => {
        try {
          const result = await cmd();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
      this.processQueue();
    });
  }

  async connect(settings: any): Promise<void> {
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch { }
      this.client = null;
    }

    this.client = new ZKLib(settings.ip, settings.port, settings.timeout, true);
    await this.queueCommand(async () => {
      // node-zklib uses createSocket() to establish connection, not connect()
      // The 4th parameter (inport) is used for UDP fallback
      await this.client.createSocket();
      deviceLogger.info("Connected to ZKTeco device");
    });
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.disconnect();
      deviceLogger.info("Disconnected from ZKTeco device");
    } catch { }
    this.client = null;
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) throw new Error("Not connected to device");
    // testConnection is not a method in node-zklib - use getSocketStatus or getInfo instead
    // First check if socket exists and is connected
    const status = await this.client.getSocketStatus?.();
    if (status !== undefined && status !== null) {
      return status;
    }
    // Fallback: try to get device info as a connectivity test
    await this.client.getInfo();
    return true;
  }

  async getDeviceInfo(): Promise<DeviceInfoPayload> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const info = await this.client.getInfo();
      return {
        model: info?.model ?? undefined,
        serialNumber: info?.serialNumber ?? undefined,
        firmwareVersion: info?.firmwareVersion ?? undefined,
        userCount: info?.userCount ?? undefined,
        attendanceCount: info?.attendanceCount ?? undefined,
        deviceName: "ZKTeco K70",
      };
    });
  }

  async getUsers(): Promise<DeviceUserPayload[]> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const res = await this.client.getUsers();
      return res?.data ?? [];
    });
  }

  async getAttendance(): Promise<DeviceAttendancePayload[]> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      try {
        const response = await this.client.getAttendances();
        const logs = Array.isArray(response?.data) ? response.data : [];
        deviceLogger.info("Fetched attendance logs from device", { count: logs.length, sampleLog: logs[0] });
        return logs;
      } catch (error) {
        throw new Error(
          `Failed to read attendance: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async addUser(user: DeviceUserPayload): Promise<void> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      // setUser is not a method in node-zklib - implement using executeCmd with CMD_USER_WRQ
      // This is a simplified implementation - actual user enrollment may require more complex handling
      // Note: node-zklib doesn't support setUser directly, need to use executeCmd or implement custom logic
      deviceLogger.warn("addUser: node-zklib doesn't support setUser directly. Use executeCmd for user management.");
      // For now, we'll use executeCmd with CMD_USER_WRQ - but actual implementation needs proper buffer encoding
      // This is a placeholder that logs the limitation
    });
  }

  async updateUser(user: DeviceUserPayload): Promise<void> {
    if (!this.client) throw new Error("Not connected to device");
    // Same as addUser - node-zklib doesn't have setUser method
    return this.addUser(user);
  }

  async deleteUser(userId: number): Promise<void> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      // Note: The original code was calling clearAttendanceLog() which was incorrect
      // node-zklib doesn't have a direct delete user method
      // Proper implementation would use CMD_DELETE_USER with proper buffer encoding
      deviceLogger.warn(`deleteUser: node-zklib doesn't support direct user deletion. UserId ${userId} was provided.`);
      // This is a placeholder - actual implementation would need proper protocol handling
    });
  }

  async clearAttendance(): Promise<void> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      try {
        await this.client.clearAttendanceLog();
      } catch (error) {
        throw new Error(
          `Failed to clear attendance: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async restart(): Promise<void> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      try {
        await this.client.executeCmd(COMMANDS.CMD_RESTART, Buffer.from(''));
      } catch (error) {
        throw new Error(
          `Failed to restart device: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async executeCommand(cmd: number, payload?: Buffer): Promise<any> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const res = await this.client.executeCmd(cmd, payload);
      return res;
    });
  }

  async getTime(): Promise<Date> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const info = await this.client.getInfo();
      return new Date();
    });
  }
}