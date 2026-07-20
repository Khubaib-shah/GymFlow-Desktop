import ZKLib from "zklib-ts";
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

  private realTimeCleanup: (() => void) | null = null;

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
        10000,
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
    this.stopRealTimeLogs();

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

  isSocketAlive(): boolean {
    if (!this.client || !this.client.ztcp || !this.client.ztcp.socket) return false;
    return !this.client.ztcp.socket.destroyed && this.client.ztcp.socket.writable;
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      throw new Error("Not connected to device");
    }

    return this.queueCommand(async () => {
      if (this.isSocketAlive()) return true;
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
        deviceName: "ZKTeco K40",
      };
    });
  }

  async getUsers(): Promise<DeviceUserPayload[]> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      try {
        const res = (await this.withTimeout(
          this.client.getUsers(),
          10000,
        )) as any;
        return res?.data ?? [];
      } catch (err: any) {
        let errMsg = "";
        if (err instanceof Error) errMsg = err.message;
        else if (err && err.err instanceof Error) errMsg = err.err.message;
        else if (err && typeof err.err === 'string') errMsg = err.err;
        else errMsg = typeof err === 'string' ? err : JSON.stringify(err);

        if (errMsg.includes("ERROR_IN_UNHANDLE_CMD")) {
          deviceLogger.info("Device returned ERROR_IN_UNHANDLE_CMD for getUsers. Assuming no users.");
          return [];
        }
        throw err;
      }
    });
  }

  async getTemplates(): Promise<any[]> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      try {
        const res = (await this.withTimeout(
          this.client.getTemplates(),
          10000,
        )) as any;
        return res?.data ?? [];
      } catch (err: any) {
        let errMsg = "";
        if (err instanceof Error) errMsg = err.message;
        else if (err && err.err instanceof Error) errMsg = err.err.message;
        else if (err && typeof err.err === 'string') errMsg = err.err;
        else errMsg = typeof err === 'string' ? err : JSON.stringify(err);

        if (errMsg.includes("ERROR_IN_UNHANDLE_CMD")) {
          deviceLogger.info("Device returned ERROR_IN_UNHANDLE_CMD for getTemplates. Assuming no templates.");
          return [];
        }
        throw err;
      }
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
      } catch (error: any) {
        let errMsg = "";
        if (error instanceof Error) errMsg = error.message;
        else if (error && error.err instanceof Error) errMsg = error.err.message;
        else if (error && typeof error.err === 'string') errMsg = error.err;
        else errMsg = typeof error === 'string' ? error : JSON.stringify(error);

        if (errMsg.includes("ERROR_IN_UNHANDLE_CMD")) {
          deviceLogger.info("Device returned ERROR_IN_UNHANDLE_CMD for getAttendances. Assuming empty log.");
          return [];
        }
        throw new Error(`Failed to read attendance: ${errMsg}`);
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
          `Failed to set user: ${error instanceof Error ? error.message : String(error)
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

  async setTime(time: Date): Promise<void> {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      await this.withTimeout(this.client.setTime(time), 5000);
    });
  }

  /**
   * Register for real-time attendance events from the device.
   * The device pushes events immediately when a fingerprint is scanned.
   */
  async startRealTimeLogs(
    onAttendance: (record: { userId: string; attTime: Date; exactTime: string }) => void,
  ): Promise<void> {
    this.stopRealTimeLogs();

    if (!this.client) {
      throw new Error("Not connected to device");
    }

    try {
      await this.client.getRealTimeLogs((log: any) => {
        try {
          if (log.event === 1 && log.payload) { // EF_ATTLOG
            const buffer = log.payload;
            const userId = buffer.subarray(0, 24).toString("ascii").split("\0").shift();
            if (!userId) return;

            // Read date components directly from buffer bytes
            const year = buffer.readUInt8(26) + 2000;
            const month = buffer.readUInt8(27);
            const day = buffer.readUInt8(28);
            const hour = buffer.readUInt8(29);
            const minute = buffer.readUInt8(30);
            const second = buffer.readUInt8(31);

            const attTime = new Date(year, month - 1, day, hour, minute, second);

            const ampm = hour >= 12 ? "pm" : "am";
            const formattedHours = hour % 12 || 12;
            const exactTime = `${formattedHours}:${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")} ${ampm}`;

            onAttendance({ userId, attTime, exactTime });
          }
        } catch (err) {
          deviceLogger.error("Error processing real-time log", err);
        }
      });
      deviceLogger.info("Real-time event listener registered successfully");
    } catch (err) {
      throw new Error(`Failed to register real-time logs: ${err}`);
    }
  }

  stopRealTimeLogs(): void {
    if (this.realTimeCleanup) {
      this.realTimeCleanup();
      this.realTimeCleanup = null;
    }
  }
}
