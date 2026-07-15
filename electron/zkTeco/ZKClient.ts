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

  /**
   * Register for real-time attendance events from the device.
   * The device pushes events immediately when a fingerprint is scanned.
   * Only one real-time listener can be active at a time.
   *
   * Returns an unsubscribe function.
   */
  startRealTimeLogs(
    onAttendance: (record: { userId: string; attTime: Date }) => void,
  ): () => void {
    this.stopRealTimeLogs();

    if (!this.client) {
      throw new Error("Not connected to device");
    }

    const transport = this.client.zklibTcp || this.client.zklibUdp;
    if (!transport || !transport.socket) {
      throw new Error("Device socket not available");
    }

    // CMD_REG_EVENT = 500, EF_ATTLOG = 1 (from node-zklib constants)
    const EV_CMD_REG_EVENT = 500;
    const EV_EF_ATTLOG = 1;

    const handler = (data: Buffer) => {
      try {
        // checkNotEventTCP equivalent: verify this is an attendance event
        if (data.length < 16) return;
        const commandId = data.readUIntLE(8, 2);
        const event = data.readUIntLE(12, 2);
        if (event !== EV_EF_ATTLOG || commandId !== EV_CMD_REG_EVENT) return;

        // Decode 52-byte real-time log record
        const recvData = data.slice(16);
        const userId = recvData
          .slice(0, 9)
          .toString("ascii")
          .split("\0")
          .shift();
        if (userId == null || userId === "") return;

        const hex = recvData.subarray(26, 32);
        const year = hex.readUIntLE(0, 1);
        const month = hex.readUIntLE(1, 1);
        const date = hex.readUIntLE(2, 1);
        const hour = hex.readUIntLE(3, 1);
        const minute = hex.readUIntLE(4, 1);
        const second = hex.readUIntLE(5, 1);
        const attTime = new Date(2000 + year, month - 1, date, hour, minute, second);

        if (userId) {
          onAttendance({ userId, attTime });
        }
      } catch {
        // Ignore malformed packets
      }
    };

    transport.socket.on("data", handler);

    try {
      transport.replyId++;
      const { createTCPHeader } = require("node-zklib/utils");

      const buf = createTCPHeader(
        EV_CMD_REG_EVENT,
        transport.sessionId,
        transport.replyId,
        Buffer.from([0x01, 0x00, 0x00, 0x00]),
      );
      transport.socket.write(buf);
    } catch (err) {
      transport.socket.removeListener("data", handler);
      throw err;
    }

    this.realTimeCleanup = () => {
      try {
        if (transport.socket) {
          transport.socket.removeListener("data", handler);
        }
      } catch {
        // ignore
      }
    };

    return this.realTimeCleanup!;
  }

  stopRealTimeLogs(): void {
    if (this.realTimeCleanup) {
      this.realTimeCleanup();
      this.realTimeCleanup = null;
    }
  }
}
