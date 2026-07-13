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
  /** Tracks whether initial sync has been done */
  private initialSyncDone = false;
  /** Tracks if we're in initial sync mode (polling disabled) */
  private skipPolling = true;
  /** Tracks the last emitted status message to avoid duplicate status events */
  private lastStatusEmitHash: string | null = null;
  /** Prevents timer callbacks from running after disconnect/cleanup */
  private disposed = false;

  constructor() {
    super();
    // Prevent MaxListenersExceededWarning - the bridge registers 'attendance' and 'status' listeners
    this.setMaxListeners(20);
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
    this.disposed = true;
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

      return {
        ...status,
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

  /**
   * Sync all existing attendance records from the device.
   * This is called after the app starts to fetch attendance that was recorded
   * while the application was closed. It emits events for the bridge to process.
   * On first call, it processes ALL logs (not just new ones).
   */
  async syncAttendance(): Promise<{ success: boolean; data?: { total: number }; error?: string }> {
    if (!this.connected) {
      try {
        await this.connect();
      } catch (error) {
        return { success: false, error: toErrorMessage(error) };
      }
    }

    try {
      const logs = await this.client.getAttendance();

      // On first sync (startup), process ALL logs to catch up with attendance
      // recorded while the app was closed. Otherwise, only process new logs.
      let logsToProcess: any[];
      if (!this.initialSyncDone) {
        // First sync: process all logs (polling was skipped, so nothing to filter)
        logsToProcess = logs;
        this.initialSyncDone = true;
        this.skipPolling = false; // Enable polling after initial sync
      } else {
        // Subsequent syncs: only process logs not already seen
        logsToProcess = logs.filter((log: any) => {
          const key = `${log.userId ?? log.uid ?? log.deviceUserId ?? 'unknown'}-${log.timestamp ?? log.attTime ?? ''}`;
          return !this.lastAttendanceFingerprint.has(key);
        });
      }

      // Emit events for the bridge to process
      if (logsToProcess.length > 0) {
        this.emit('attendance', logsToProcess, true);
      }

      // Mark all processed logs as seen
      for (const log of logsToProcess) {
        const key = `${log.userId ?? log.uid ?? log.deviceUserId ?? 'unknown'}-${log.timestamp ?? log.attTime ?? ''}`;
        this.lastAttendanceFingerprint.add(key);
      }

      return { success: true, data: { total: logsToProcess.length } };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }

  /** On startup, connect to device only. The fingerprint set and polling are handled
   *  in syncAttendance() to ensure logs are processed when the renderer is ready. */
  private async initializeAttendanceFingerprint(): Promise<void> {
    try {
      // Connect to device if not already connected
      if (!this.connected) {
        try {
          await this.connect();
        } catch {
          // Device not reachable at startup - sync will happen on reconnect
          return;
        }
      }
      // Don't populate fingerprint set here - let syncAttendance() handle it
      this.isFirstPoll = false;
    } catch {
      // If device is unreachable at startup, we'll sync on reconnect
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    const interval = this.settings.pollInterval || DEFAULT_POLL_INTERVAL_MS;
    this.pollTimer = setInterval(async () => {
      // Skip polling if we're still in initial sync mode (renderer not ready yet)
      if (this.disposed || !this.connected || this.skipPolling) return;
      try {
        // Directly call client.getAttendance() to avoid triggering auto-connect
        const logs = await this.client.getAttendance();
        const newLogs = logs.filter((log: any) => {
          const key = `${log.userId ?? log.uid ?? log.deviceUserId ?? 'unknown'}-${log.timestamp ?? log.attTime ?? ''}`;
          return !this.lastAttendanceFingerprint.has(key);
        });
        // Keep fingerprint set bounded to last 500 entries to avoid memory bloat
        const updatedSet = new Set<string>();
        const existing = Array.from(this.lastAttendanceFingerprint);
        // Keep the most recent entries (up to 500) plus the new ones
        const toKeep = existing.slice(-500);
        for (const k of toKeep) updatedSet.add(k);
        for (const item of newLogs) {
          updatedSet.add(`${item.userId ?? item.uid ?? item.deviceUserId ?? 'unknown'}-${item.timestamp ?? item.attTime ?? ''}`);
        }
        this.lastAttendanceFingerprint = updatedSet;

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
      if (this.disposed || !this.connected || this.isReconnecting) return;
      this.isReconnecting = true;
      try {
        // Exponential backoff: increase interval based on consecutive failures
        const backoffMs = Math.min(
          1000 * Math.pow(2, Math.min(this.consecutiveFailures, 10)),
          300000 // cap at 5 minutes
        );
        // Skip this cycle if we're still in backoff period
        const now = Date.now();
        const lastFailure = (this as any)._lastFailureTime || 0;
        if (now - lastFailure < backoffMs) {
          return;
        }
        (this as any)._lastFailureTime = now;
        await this.connect();
      } catch {
        // retry on next interval
      } finally {
        this.isReconnecting = false;
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