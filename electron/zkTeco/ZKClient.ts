import ZKLib from "node-zklib";
import type {
  DeviceUserPayload,
  DeviceUser,
  DeviceAttendancePayload,
  DeviceInfoPayload,
  ZkTecoDeviceSettings,
} from "./types";
import { deviceLogger } from "./DeviceLogger";
import { COMMANDS } from "./constants";
import { createUserPacket } from "./helpers/createUserPacket";
import { createDeleteUserPacket } from "./helpers/createDeleteUserPacket";

export class ZKClient {
  private client: any = null;
  private commandQueue: (() => Promise<any>)[] = [];
  private isProcessing = false;

  private isConnecting = false;
  private isDisconnecting = false;
  private connectionId = 0;

  private async withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Operation timed out")), ms),
      ),
    ]);
  }

  private async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.commandQueue.length > 0) {
      const cmd = this.commandQueue.shift();
      if (cmd) {
        try {
          await cmd();
        } catch (err) {
          deviceLogger.error("Queue command failed", err);
        }
      }
    }

    this.isProcessing = false;
  }

  private queueCommand<T>(cmd: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const connectionId = this.connectionId;

      this.commandQueue.push(async () => {
        try {
          if (connectionId !== this.connectionId) {
            throw new Error("Connection changed");
          }

          const result = await cmd();

          if (connectionId !== this.connectionId) {
            throw new Error("Connection changed");
          }

          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      void this.processQueue();
    });
  }

  async connect(settings: ZkTecoDeviceSettings): Promise<void> {
    if (this.isConnecting) {
      throw new Error("Already connecting");
    }

    this.isConnecting = true;

    try {
      this.connectionId++;

      if (this.client) {
        try {
          await this.withTimeout(this.client.disconnect(), 3000);
        } catch (err) {
          deviceLogger.warn("Disconnect timeout", err);
        } finally {
          this.client = null;
        }
      }

      this.commandQueue = [];

      this.client = new ZKLib(
        settings.ip,
        settings.port,
        settings.timeout,
        true,
      );

      try {
        await this.withTimeout(
          this.client.createSocket(),
          settings.timeout + 2000,
        );
      } catch (error) {
        this.client = null;
        throw new Error(
          `Failed to connect to ZKTeco device: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      deviceLogger.info("Connected to ZKTeco device");
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isDisconnecting) {
      return;
    }

    this.isDisconnecting = true;

    try {
      this.connectionId++;

      this.commandQueue = [];

      if (!this.client) {
        return;
      }

      try {
        await this.withTimeout(this.client.disconnect(), 3000);

        deviceLogger.info("Disconnected from ZKTeco device");
      } catch (err) {
        deviceLogger.warn("Disconnect timeout", err);
      } finally {
        this.client = null;
      }
    } finally {
      this.isDisconnecting = false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      throw new Error("Not connected to device");
    }

    return this.queueCommand(async () => {
      const status = await this.client.getSocketStatus?.();

      if (status !== undefined && status !== null) {
        return status;
      }

      await this.withTimeout(this.client.getInfo(), 5000);

      return true;
    });
  }

  async getDeviceInfo(): Promise<DeviceInfoPayload> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const info = (await this.withTimeout(
        this.client.getInfo(),
        10000,
      )) as any;
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
      const res = (await this.withTimeout(
        this.client.getUsers(),
        10000,
      )) as any;
      return res?.data ?? [];
    });
  }

  async getAttendance(): Promise<DeviceAttendancePayload[]> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      try {
        const response = (await this.withTimeout(
          this.client.getAttendances(),
          15000,
        )) as any;
        const logs = Array.isArray(response?.data) ? response.data : [];
        deviceLogger.info("Fetched attendance logs from device", {
          count: logs.length,
          sampleLog: logs[0],
        });
        return logs;
      } catch (error) {
        throw new Error(
          `Failed to read attendance: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async setUser(user: DeviceUserPayload): Promise<void> {
    return this.queueCommand<void>(async () => {
      const packet = createUserPacket(user as DeviceUser);

      await this.withTimeout(
        this.client.executeCmd(COMMANDS.CMD_DISABLEDEVICE),
        5000,
      );

      try {
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_USER_WRQ, packet),
          10000,
        );

        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_REFRESHDATA),
          5000,
        );
      } catch (error) {
        throw new Error(
          `Failed to set user: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      } finally {
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_ENABLEDEVICE),
          5000,
        );
      }
    });
  }

  async addUser(user: DeviceUserPayload): Promise<void> {
    await this.setUser(user);
  }

  async updateUser(user: DeviceUserPayload): Promise<void> {
    await this.setUser(user);
  }

  async deleteUser(userId: number): Promise<void> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const packet = createDeleteUserPacket(userId);

      await this.withTimeout(
        this.client.executeCmd(COMMANDS.CMD_DISABLEDEVICE),
        5000,
      );

      try {
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_DELETE_USER, packet),
          10000,
        );

        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_REFRESHDATA),
          5000,
        );
      } finally {
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_ENABLEDEVICE),
          5000,
        );
      }
    });
  }

  async clearAttendance(): Promise<void> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      try {
        await this.withTimeout(this.client.clearAttendanceLog(), 10000);
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
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_RESTART, Buffer.from("")),
          5000,
        );
      } catch (error) {
        throw new Error(
          `Failed to restart device: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async executeCommand(cmd: number, payload?: Buffer): Promise<any> {
    if (!this.client || this.isDisconnecting || this.isConnecting) {
      throw new Error("Device is not ready");
    }
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      return await this.withTimeout(
        this.client.executeCmd(cmd, payload),
        10000,
      );
    });
  }

  async getTime(): Promise<Date> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const time = await this.client.getTime();
      return time;
    });
  }
}
