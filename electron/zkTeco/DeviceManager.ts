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
  private isFirstPoll = true;
  private isReconnecting = false;
  private consecutiveFailures = 0;
  /** Tracks the last emitted status message to avoid duplicate status events */
  private lastStatusEmitHash: string | null = null;

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
      this.consecutiveFailures = 0;
      this.lastConnectedAt = new Date().toISOString();
      this.emitStatusOnce('connected', 'Connected successfully');
      return this.buildStatus('connected', 'Connected successfully');
    } catch (error) {
      this.connected = false;
      this.consecutiveFailures++;
      this.emitStatusOnce('offline', toErrorMessage(error));
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
    this.emitStatusOnce('disconnected', 'Device disconnected');
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

      const serialNumber = infoAny?.serialNumber
        || infoAny?.serial
        || infoAny?.sn
        || infoAny?.deviceSerial
        || undefined;

      return {
        ...status,
        firmwareVersion,
        serialNumber,
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

  getStatus(): DeviceStatusPayload {
    return this.buildStatus(
      this.connected ? 'connected' : 'offline',
      this.connected ? 'Connected' : 'Disconnected',
    );
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
    // Reset the status emit hash so lifecycle events are always emitted fresh
    this.lastStatusEmitHash = null;
    this.initializeAttendanceFingerprint();
    this.startPolling();
    this.scheduleReconnect();
  }

  /** On startup, pre-populate the fingerprint set with ALL existing attendance logs
   *  so they are never re-processed on app restart. This solves the issue of
   *  re-matching old check-ins/check-outs every time the software starts. */
  private async initializeAttendanceFingerprint(): Promise<void> {
    try {
      // Manually connect first to get logs without triggering auto-connect side effects
      if (!this.connected) {
        try {
          await this.connect();
        } catch {
          // Device not reachable at startup - fingerprint will populate on first poll
          return;
        }
      }
      const logs = await this.client.getAttendance();
      for (const log of logs) {
        const key = `${log.userId ?? log.uid ?? log.deviceUserId ?? 'unknown'}-${log.timestamp ?? log.attTime ?? ''}`;
        this.lastAttendanceFingerprint.add(key);
      }
      this.isFirstPoll = false; // skip first-poll logic entirely
    } catch {
      // If device is unreachable at startup, we'll populate on first successful poll
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    const interval = this.settings.pollInterval || DEFAULT_POLL_INTERVAL_MS;
    this.pollTimer = setInterval(async () => {
      if (!this.connected) return; // scheduleReconnect handles reconnection
      try {
        // Directly call client.getAttendance() to avoid triggering auto-connect
        const logs = await this.client.getAttendance();
        const newLogs = logs.filter((log: any) => {
          const key = `${log.userId ?? log.uid ?? log.deviceUserId ?? 'unknown'}-${log.timestamp ?? log.attTime ?? ''}`;
          return !this.lastAttendanceFingerprint.has(key);
        });
        this.lastAttendanceFingerprint = new Set([...Array.from(this.lastAttendanceFingerprint).slice(-200), ...newLogs.map((item: any) => `${item.userId ?? item.uid ?? item.deviceUserId ?? 'unknown'}-${item.timestamp ?? item.attTime ?? ''}`)]);

        if (newLogs.length > 0) {
          this.emit('attendance', newLogs, false);
        }
      } catch (error) {
        // Only emit offline if we were previously connected (prevents duplicate status spam)
        if (this.connected) {
          this.connected = false;
          this.consecutiveFailures++;
          this.emitStatusOnce('offline', toErrorMessage(error));
        }
      }
    }, interval);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(async () => {
      if (!this.connected && !this.isReconnecting) {
        this.isReconnecting = true;
        try {
          // Exponential backoff: skip reconnect attempts if we've failed too many times recently
          if (this.consecutiveFailures > 5) {
            // Wait longer between retries: skip this interval if we've failed >5 times
            // The next interval will try again
            return;
          }
          await this.connect();
        } catch {
          // retry on next interval
        } finally {
          this.isReconnecting = false;
        }
      }
    }, DEFAULT_RECONNECT_INTERVAL_MS);
  }

  /** Emits a status event only if the status message has changed, to prevent flickering */
  private emitStatusOnce(status: DeviceStatusPayload['status'], message: string): void {
    const hash = `${status}:${message}`;
    if (this.lastStatusEmitHash === hash) return;
    this.lastStatusEmitHash = hash;
    this.emit('status', this.buildStatus(status, message));
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