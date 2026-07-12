import { EventEmitter } from 'events';
import { DEFAULT_RECONNECT_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS } from './constants';
import { ConnectionError } from './errors/ConnectionError';
import { DeviceError } from './errors/DeviceError';
import { ZKClient } from './ZKClient';
import { deviceSettingsStore } from './DeviceSettings';
import type { DeviceAttendancePayload, DeviceInfoPayload, DeviceStatusPayload, DeviceUserPayload, ZkTecoDeviceSettings } from './types';
import { createStructuredError, toErrorMessage } from './utils';
import { deviceLogger } from './DeviceLogger';

export class DeviceManager extends EventEmitter {
  private client = new ZKClient();
  private settings: ZkTecoDeviceSettings = deviceSettingsStore.load();
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastConnectedAt: string | null = null;
  private lastAttendanceFingerprint = new Set<string>();

  constructor() {
    super();
  }

  async applySettings(settings: Partial<ZkTecoDeviceSettings>): Promise<ZkTecoDeviceSettings> {
    this.settings = deviceSettingsStore.save(settings);
    return this.settings;
  }

  getSettings(): ZkTecoDeviceSettings {
    this.settings = deviceSettingsStore.load();
    return { ...this.settings };
  }

  async connect(): Promise<DeviceStatusPayload> {
    if (!this.settings.enabled || !this.settings.ip) {
      throw new ConnectionError('Device is disabled or IP is not configured');
    }

    try {
      await this.client.connect(this.settings);
      this.connected = true;
      this.lastConnectedAt = new Date().toISOString();
      this.emit('status', this.buildStatus('connected', 'Connected successfully'));
      return this.buildStatus('connected', 'Connected successfully');
    } catch (error) {
      this.connected = false;
      this.emit('status', this.buildStatus('offline', toErrorMessage(error)));
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reconnectTimer) clearInterval(this.reconnectTimer);
    this.pollTimer = null;
    this.reconnectTimer = null;
    await this.client.disconnect();
    this.connected = false;
    this.emit('status', this.buildStatus('disconnected', 'Device disconnected'));
  }

  async reconnect(): Promise<DeviceStatusPayload> {
    await this.disconnect();
    return this.connect();
  }

  async testConnection(): Promise<DeviceStatusPayload> {
    try {
      const status = await this.connect();
      const info = await this.getDeviceInfo();
      // Log full device info to help diagnose missing firmware fields
      try {
        deviceLogger.info('Device info retrieved', info);
      } catch {
        // ignore logging errors
      }
      const users = await this.getUsers();
      const attendance = await this.getAttendance();
      // `info` may have different shapes depending on the client/library version.
      // Cast to `any` so TypeScript allows checking multiple possible property names.
      const infoAny: any = info;
      const firmwareVersion = infoAny?.firmwareVersion
        || infoAny?.firmware
        || infoAny?.firmwareVer
        || infoAny?.ver
        || infoAny?.version
        || infoAny?.firmware_ver
        || infoAny?.firmVer
        || infoAny?.firmver
        || 'Unknown';

      return {
        ...status,
        firmwareVersion,
        userCount: users.length,
        attendanceCount: attendance.length,
      };
    } catch (error) {
      const message = toErrorMessage(error);
      return this.buildStatus('offline', message);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getDeviceInfo(): Promise<DeviceInfoPayload> {
    if (!this.connected) {
      await this.connect();
    }
    return this.client.getDeviceInfo();
  }

  async getUsers(): Promise<DeviceUserPayload[]> {
    if (!this.connected) {
      await this.connect();
    }
    return this.client.getUsers();
  }

  async getAttendance(): Promise<DeviceAttendancePayload[]> {
    if (!this.connected) {
      await this.connect();
    }
    return this.client.getAttendance();
  }

  async addUser(user: DeviceUserPayload): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    try {
      await this.client.addUser(user);
    } catch (error) {
      // rethrow as DeviceError so createStructuredError can surface details
      throw new DeviceError(toErrorMessage(error));
    }
  }

  async updateUser(user: DeviceUserPayload): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    try {
      await this.client.updateUser(user);
    } catch (error) {
      throw new DeviceError(toErrorMessage(error));
    }
  }

  async deleteUser(userId: number): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    try {
      await this.client.deleteUser(userId);
    } catch (error) {
      throw new DeviceError(toErrorMessage(error));
    }
  }

  async clearAttendance(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    await this.client.clearAttendance();
  }

  async restartDevice(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    await this.client.restart();
  }

  /**
   * Poll the device for a user's fingerprint/templates until detected or timeout.
   * Returns true if templates were detected, false on timeout.
   */
  async waitForEnrollment(employeeNo: number, timeoutMs = 60000, intervalMs = 2000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const users = await this.getUsers();
        const user = users.find((u: any) => {
          const uid = u.uid ?? u.userId ?? u.id ?? u.employeeNo ?? u.userid ?? u.cardNumber;
          return String(uid) === String(employeeNo);
        });
        if (user) {
          // Heuristics for fingerprint/template presence
          const hasTemplates = Array.isArray(user.templates) && user.templates.length > 0;
          const hasFingerprints = Array.isArray(user.fingerprints) && user.fingerprints.length > 0;
          const hasTemplateFields = Object.keys(user).some(k => /template|finger|fp/i.test(k) && (Array.isArray((user as any)[k]) ? (user as any)[k].length > 0 : Boolean((user as any)[k])));
          if (hasTemplates || hasFingerprints || hasTemplateFields) return true;
        }
      } catch (err) {
        // ignore and retry until timeout
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }

  startAutoLifecycle(): void {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.ip) return;
    this.startPolling();
    this.scheduleReconnect();
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    const interval = this.settings.pollInterval || DEFAULT_POLL_INTERVAL_MS;
    this.pollTimer = setInterval(async () => {
      if (!this.connected) {
        try {
          await this.connect();
        } catch {
          // will retry later
        }
        return;
      }
      try {
        const logs = await this.getAttendance();
        const newLogs = logs.filter((log: any) => {
          const key = `${log.userId ?? log.uid ?? log.deviceUserId ?? 'unknown'}-${log.timestamp ?? log.attTime ?? ''}`;
          return !this.lastAttendanceFingerprint.has(key);
        });
        this.lastAttendanceFingerprint = new Set([...Array.from(this.lastAttendanceFingerprint).slice(-200), ...newLogs.map((item: any) => `${item.userId ?? item.uid ?? item.deviceUserId ?? 'unknown'}-${item.timestamp ?? item.attTime ?? ''}`)]);
        if (newLogs.length > 0) {
          this.emit('attendance', newLogs);
        }
      } catch (error) {
        this.emit('status', this.buildStatus('offline', toErrorMessage(error)));
        this.connected = false;
      }
    }, interval);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(async () => {
      if (!this.connected) {
        try {
          await this.connect();
        } catch {
          // retry
        }
      }
    }, DEFAULT_RECONNECT_INTERVAL_MS);
  }

  private buildStatus(status: DeviceStatusPayload['status'], message: string): DeviceStatusPayload {
    return {
      connected: status === 'connected',
      status,
      message,
      firmwareVersion: undefined,
      userCount: undefined,
      attendanceCount: undefined,
      lastConnectedAt: this.lastConnectedAt,
      deviceName: 'ZKTeco K70',
    };
  }
}

export const deviceManager = new DeviceManager();
