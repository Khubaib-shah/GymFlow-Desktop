import { ConnectionError } from "./errors/ConnectionError";
import { DeviceError } from "./errors/DeviceError";
import { createUserPacket } from "./helpers/createUserPacket";
import { createDeleteUserPacket } from "./helpers/createDeleteUserPacket";
const { COMMANDS } = require("node-zklib/constants");
import type {
  ZkTecoDeviceSettings,
  DeviceUser,
  DeviceAttendancePayload,
} from "./types";
import { decodeUserData72 } from "./helpers/decodeUserData72";

const ZKLib = require("node-zklib") as any;

export class ZKClient {
  private client: any | null = null;
  private settings: ZkTecoDeviceSettings | null = null;
  private async disableDevice() {
    await this.executeCommand(COMMANDS.CMD_DISABLEDEVICE);
  }

  private async enableDevice() {
    await this.executeCommand(COMMANDS.CMD_ENABLEDEVICE);
  }

  private async refreshData() {
    await this.executeCommand(COMMANDS.CMD_REFRESHDATA);
  }

  async connect(settings: ZkTecoDeviceSettings): Promise<void> {
    this.settings = settings;
    if (!settings.enabled || !settings.ip) {
      throw new ConnectionError("Device is disabled or IP is not configured");
    }

    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {
        // ignore
      }
      this.client = null;
    }

    try {
      this.client = new ZKLib(
        settings.ip,
        settings.port,
        settings.timeout,
        settings.pollInterval,
      );
      await this.client.createSocket();
    } catch (error) {
      this.client = null;
      throw new ConnectionError(
        `Unable to connect to ZKTeco device: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.disconnect();
    } catch {
      // ignore
    } finally {
      this.client = null;
    }
  }

  isConnected(): boolean {
    return Boolean(this.client);
  }

  private async executeCommand(command: number, data?: Buffer) {
    if (!this.client) {
      throw new ConnectionError("Device is not connected");
    }

    return this.client.executeCmd(command, data);
  }

  async getDeviceInfo(): Promise<any> {
    if (!this.client) throw new ConnectionError("Device is not connected");
    try {
      const info = await this.client.getInfo();
      return info;
    } catch (error) {
      throw new DeviceError(
        `Failed to read device info: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async setUser(user: DeviceUser): Promise<Buffer> {
    if (!this.client) throw new ConnectionError("Device is not connected");

    const packet = createUserPacket(user);
    await this.disableDevice();

    const result = await this.executeCommand(COMMANDS.CMD_USER_WRQ, packet);

    await this.refreshData();
    await this.enableDevice();

    return result;
  }

  async getUsers(): Promise<DeviceUser[]> {
    if (!this.client) {
      throw new ConnectionError("Device is not connected");
    }

    try {
      await this.client.executeCmd(COMMANDS.CMD_DISABLEDEVICE);

      const payload = Buffer.from([
        0x01, 0x09, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);

      const response = await this.client.executeCmd(
        COMMANDS.CMD_DATA_WRRQ,
        payload,
      );
      console.log("RAW RESPONSE:", response);
      console.log("HEX:", response.toString("hex"));
      console.log("LENGTH:", response.length);

      const users: DeviceUser[] = [];

      let offset = 4;
      const data = response.subarray(8);

      while (offset + 72 <= data.length) {
        users.push(decodeUserData72(data.subarray(offset, offset + 72)));
        offset += 72;
      }
      console.log("DATA LENGTH:", data.length);
      console.log("DATA HEX:", data.toString("hex"));

      await this.client.executeCmd(COMMANDS.CMD_ENABLEDEVICE);

      return users;
    } catch (error) {
      throw new DeviceError(
        `Failed to read users: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async deleteUser(uid: number) {
    const packet = createDeleteUserPacket(uid);

    console.log("Delete packet:", packet.toString("hex"));

    console.log("disable");
    await this.disableDevice();

    console.log("delete");
    const result = await this.executeCommand(COMMANDS.CMD_DELETE_USER, packet);

    console.log(result.toString("hex"));

    console.log("Delete response:", result);

    console.log("refresh");
    await this.refreshData();

    console.log("enable");
    await this.enableDevice();

    return result;
  }
  async registerRealtimeEvents() {
    const payload = Buffer.alloc(4);
    const mask =
      COMMANDS.EF_ATTLOG |
      COMMANDS.EF_VERIFY |
      COMMANDS.EF_FINGER |
      COMMANDS.EF_ENROLLUSER |
      COMMANDS.EF_ENROLLFINGER |
      COMMANDS.EF_BUTTON |
      COMMANDS.EF_UNLOCK |
      COMMANDS.EF_FPFTR |
      COMMANDS.EF_ALARM;

    payload.writeUInt32LE(mask, 0);

    console.log(mask); // should print 959

    const res = await this.executeCommand(COMMANDS.CMD_REG_EVENT, payload);

    console.log("REGISTER EVENT RESPONSE:", res?.toString("hex"));

    return res;
  }
  async getAttendance(): Promise<DeviceAttendancePayload[]> {
    if (!this.client) throw new ConnectionError("Device is not connected");
    try {
      const response = await this.client.getAttendances();
      return Array.isArray(response?.data) ? response.data : [];
    } catch (error) {
      throw new DeviceError(
        `Failed to read attendance: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async clearAttendance(): Promise<void> {
    if (!this.client) throw new ConnectionError("Device is not connected");
    try {
      await this.client.clearAttendanceLog();
    } catch (error) {
      throw new DeviceError(
        `Failed to clear attendance: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async restart(): Promise<void> {
    if (!this.client) throw new ConnectionError("Device is not connected");
    try {
      await this.client.executeCmd(COMMANDS.CMD_RESTART);
    } catch (error) {
      throw new DeviceError(
        `Failed to restart device: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
