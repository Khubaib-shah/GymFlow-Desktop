import { EventEmitter } from 'events';
import { DEFAULT_RECONNECT_INTERVAL_MS, DEFAULT_POLL_INTERVAL_MS } from './constants';
import { ConnectionError } from './errors/ConnectionError';
import { DeviceError } from './errors/DeviceError';
import { ZKClient } from './ZKClient';
import { deviceSettingsStore } from './DeviceSettings';
import type { DeviceAttendancePayload, DeviceInfoPayload, DeviceStatusPayload, DeviceUserPayload, ZkTecoDeviceSettings } from './types';
import { createStructuredError, toErrorMessage } from './utils';
import { deviceLogger } from './DeviceLogger';
// Helpers
import { recordDeviceAttendanceLog, isAttendanceLogProcessed } from './helpers/attendanceTracking';

/**
 * Round a Date to second-level precision for reliable dedup keys.
 * ZKTeco device timestamps are second-resolution; this ensures
 * consistent comparison across reads.
 */
function roundToSeconds(d: Date): Date {
  const copy = new Date(d.getTime());
  copy.setMilliseconds(0);
  return copy;
}

export class DeviceManager extends EventEmitter {
  private client = new ZKClient();
  private settings: ZkTecoDeviceSettings = deviceSettingsStore.load();
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastConnectedAt: string | null = null;
  private isReconnecting = false;
  private consecutiveFailures = 0;
  /** Tracks whether initial sync has been done */
  private initialSyncDone = false;
  /** Prevents timer callbacks from running after disconnect/cleanup */
  private disposed = false;
  /** Guards against overlapping poll cycles */
  private isPolling = false;
  /** Reference to prisma for persistent tracking - set by the app on startup */
  private prisma: any = null;
  /** In-memory set of already-seen attendance keys (userId:roundedTimestamp) to avoid redundant DB checks */
  private processedKeys: Set<string> = new Set();

  /**
   * Clear in-memory caches and reset state.
   * Useful when resetting the application database.
   */
  clearCache(): void {
    this.processedKeys.clear();
    this.initialSyncDone = false;
  }

  constructor() {
    super();
    // Prevent MaxListenersExceededWarning - the bridge registers 'attendance' and 'status' listeners
    this.setMaxListeners(20);
  }

  /**
   * Set the Prisma client reference for database-based tracking.
   * This should be called during app initialization.
   */
  setPrismaClient(prisma: any): void {
    this.prisma = prisma;
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

      // Register for real-time events after successful connection
      try {
        this.client.startRealTimeLogs((record) => {
          // Process real-time attendance event immediately
          this.processRealTimeAttendance(record).catch((err) => {
            deviceLogger.error('Real-time attendance processing error', err);
          });
        });
      } catch (rtErr) {
        // Real-time event registration is optional; polling will still work
        deviceLogger.warn('Real-time event registration failed, falling back to polling', rtErr);
      }

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
    this.client.stopRealTimeLogs();
    await this.client.disconnect();
    this.connected = false;
    this.emitStatusOnce('disconnected', 'Device disconnected');
  }

  async reconnect(): Promise<DeviceStatusPayload> {
    this.disposed = false;
    this.client.stopRealTimeLogs();
    await this.client.disconnect();
    this.connected = false;
    return this.connect();
  }

  async testConnection(): Promise<DeviceStatusPayload> {
    try {
      const status = await this.connect();
      const info = await this.getDeviceInfo();
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

  /**
   * Process a real-time attendance event from the device.
   * The device pushes these immediately when a fingerprint is scanned.
   */
  private async processRealTimeAttendance(record: { userId: string; attTime: Date }): Promise<void> {
    const deviceUserId = Number(record.userId);
    if (Number.isNaN(deviceUserId)) return;

    const checkInTime = roundToSeconds(record.attTime);
    const key = this.makeKey(deviceUserId, checkInTime);

    // Skip if already processed in this session
    if (this.processedKeys.has(key)) return;

    this.processedKeys.add(key);

    // Record in persistent tracking table
    if (this.prisma) {
      try {
        await recordDeviceAttendanceLog({
          prisma: this.prisma,
          deviceUserId,
          deviceLogId: null,
          checkInTime,
          method: "BIOMETRIC",
        });
      } catch {
        // ignore duplicate errors
      }
    }

    // Map to the DeviceAttendancePayload format the bridge expects
    const logItem: DeviceAttendancePayload = {
      deviceUserId,
      userId: deviceUserId,
      recordTime: checkInTime,
      attTime: checkInTime,
      method: "BIOMETRIC",
    };

    // Emit to bridge for processing
    this.emit('attendance', [logItem], false);

    deviceLogger.info("Real-time attendance event", {
      deviceUserId,
      checkInTime: checkInTime.toISOString(),
    });
  }

  /**
   * Extract the timestamp from a device attendance log item.
   * Returns a Date rounded to seconds for consistent dedup.
   */
  private getLogTimestamp(log: DeviceAttendancePayload): Date {
    const raw = log.recordTime ?? log.timestamp ?? log.attTime ?? log.checkInTime ?? log.date;
    if (raw == null) return new Date();
    if (raw instanceof Date) return roundToSeconds(raw);
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? new Date() : roundToSeconds(d);
  }

  /**
   * Extract the device user ID from a log item.
   */
  private getLogDeviceUserId(log: DeviceAttendancePayload): number | null {
    const raw = log.userId ?? log.uid ?? log.deviceUserId ?? log.userSn;
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  }

  /**
   * Build a fast deduplication key from deviceUserId + rounded timestamp.
   * Example: "123:1763280000"
   */
  private makeKey(deviceUserId: number, checkInTime: Date): string {
    return `${deviceUserId}:${Math.floor(checkInTime.getTime() / 1000)}`;
  }

  /** Build a key from a log item */
  private getLogKey(log: DeviceAttendancePayload): string {
    const deviceUserId = this.getLogDeviceUserId(log) ?? 0;
    const checkInTime = this.getLogTimestamp(log);
    return this.makeKey(deviceUserId, checkInTime);
  }

  startAutoLifecycle(): void {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.ip) return;
    // Reset state for fresh start
    this.initialSyncDone = false;
    this.consecutiveFailures = 0;
    this.connected = false;
    this.disposed = false;
    // Clear in-memory cache so we start fresh
    this.processedKeys.clear();
    this.startPolling();
    this.scheduleReconnect();
  }

  /**
   * Sync all existing attendance records from the device.
   * This is called after the app starts to fetch attendance that was recorded
   * while the application was closed. It emits events for the bridge to process.
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

      // Filter out logs that have already been processed (persistent deduplication)
      const unprocessedLogs: DeviceAttendancePayload[] = [];

      for (const log of logs) {
        const deviceUserId = this.getLogDeviceUserId(log);
        if (deviceUserId == null) continue;

        const checkInTime = this.getLogTimestamp(log);

        // Check in-memory set first (fast)
        const key = this.makeKey(deviceUserId, checkInTime);
        if (this.processedKeys.has(key)) continue;

        // Check database (persistent dedup)
        let isProcessed = false;
        if (this.prisma) {
          isProcessed = await isAttendanceLogProcessed({
            prisma: this.prisma,
            deviceUserId,
            deviceLogId: log.deviceLogId ?? (log.id ? Number(log.id) : null),
            checkInTime,
            method: log.method ?? "BIOMETRIC",
          });
        }

        if (!isProcessed) {
          unprocessedLogs.push(log);
        }

        this.processedKeys.add(key);
      }

      // Emit events for the bridge to process
      if (unprocessedLogs.length > 0) {
        this.emit('attendance', unprocessedLogs, true);
      }

      // Mark all processed logs in the database
      for (const log of unprocessedLogs) {
        const deviceUserId = this.getLogDeviceUserId(log);
        const checkInTime = this.getLogTimestamp(log);

        if (this.prisma && deviceUserId != null) {
          try {
            await recordDeviceAttendanceLog({
              prisma: this.prisma,
              deviceUserId,
              deviceLogId: log.deviceLogId ?? (log.id ? Number(log.id) : null),
              checkInTime,
              method: log.method ?? "BIOMETRIC",
            });
          } catch {
            // ignore duplicate errors
          }
        }
      }

      this.initialSyncDone = true;

      return { success: true, data: { total: unprocessedLogs.length } };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    const interval = this.settings.pollInterval || DEFAULT_POLL_INTERVAL_MS;
    
    // Convert to a lightweight watchdog instead of heavy polling.
    // startRealTimeLogs already handles real-time attendance natively.
    this.pollTimer = setInterval(async () => {
      if (this.disposed || this.isPolling) return;
      this.isPolling = true;

      if (!this.connected) {
        try {
          await this.connect();
        } catch (err) {
          deviceLogger.warn("Watchdog: Connection failed, will retry on next cycle", {
            error: err instanceof Error ? err.message : String(err),
          });
          this.isPolling = false;
          return;
        }
      } else {
        // Ping the device to ensure connection is actually alive
        try {
          await this.client.getDeviceInfo();
        } catch (err) {
          deviceLogger.error("Watchdog: Connection died, triggering reconnect", err);
          this.connected = false;
          this.consecutiveFailures++;
          this.emitStatusOnce('offline', toErrorMessage(err));
        }
      }
      this.isPolling = false;
    }, interval);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(async () => {
      if (this.disposed || this.isReconnecting) return;
      this.isReconnecting = true;
      try {
        // Exponential backoff
        const backoffMs = Math.min(
          1000 * Math.pow(2, Math.min(this.consecutiveFailures, 10)),
          300000
        );
        const now = Date.now();
        const lastFailure = (this as any)._lastFailureTime || 0;
        if (now - lastFailure < backoffMs) {
          return;
        }
        (this as any)._lastFailureTime = now;

        if (!this.connected) {
          try {
            this.client.stopRealTimeLogs();
            await this.connect();
            this.consecutiveFailures = 0;
          } catch (err) {
            this.consecutiveFailures++;
          }
        }
      } finally {
        this.isReconnecting = false;
      }
    }, DEFAULT_RECONNECT_INTERVAL_MS);
  }

  /** Emits a status event only if the status message has changed */
  private emitStatusOnce(status: DeviceStatusPayload['status'], message: string): void {
    const hash = `${status}:${message}`;
    if ((this as any).lastStatusEmitHash === hash) return;
    (this as any).lastStatusEmitHash = hash;
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
