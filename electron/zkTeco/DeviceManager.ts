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
import { recordDeviceAttendanceLog, isAttendanceLogProcessed, getLastProcessedAttendanceTime } from './helpers/attendanceTracking';

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
  private processedKeys: Set<string> = new Set();
  private static readonly MAX_PROCESSED_KEYS = 50000;
  private realtimeEnabled = false;

  /** Tracks pending enrollments to map real-time events to the correct finger index */
  private pendingEnrollments: Map<number, number> = new Map();

  /** Mutex to prevent overlapping commands to the device */
  private commandPromise: Promise<any> = Promise.resolve();

  private executeCommand<T>(command: () => Promise<T>): Promise<T> {
    const nextPromise = this.commandPromise.then(() =>
      command().catch((err) => { throw err; })
    );
    this.commandPromise = nextPromise.catch(() => { });
    return nextPromise;
  }

  /**
   * Executes a command safely by temporarily pausing real-time events.
   * Since zklib-ts doesn't support unbinding listeners cleanly, this reconnects the socket.
   */
  private async executeSafeCommand<T>(command: () => Promise<T>): Promise<T> {
    const wasRealtime = this.realtimeEnabled;
    if (wasRealtime) {
      this.client.stopRealTimeLogs();
      await this.client.disconnect();
      await this.connect();
      this.realtimeEnabled = false;
    }

    try {
      return await this.executeCommand(command);
    } finally {
      if (wasRealtime && this.connected) {
        // Sync any offline attendance that happened while the realtime listener was paused
        await this.syncAttendance().catch((err) => {
          deviceLogger.warn("Failed to sync attendance after executeSafeCommand", err);
        });

        // Explicitly restart real-time logs
        try {
          await this.client.startRealTimeLogs(
            (record) => {
              this.processRealTimeAttendance(record).catch(err => deviceLogger.error('Real-time log error', err));
            },
            (userId) => {
              this.addRealTimeFingerprint(userId).catch(err => deviceLogger.error('Real-time enroll error', err));
            }
          );
          this.realtimeEnabled = true;
          deviceLogger.info('Real-time event listener registered successfully after safe command');
        } catch (err) {
          deviceLogger.warn('Real-time event registration failed after safe command', err);
        }
      }
    }
  }

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
      await this.executeCommand(() => this.client.connect(this.settings));

      // Auto-sync device time with PC time
      try {
        await this.client.setTime(new Date());
        deviceLogger.info('Device time synchronized with server');
      } catch (timeErr) {
        deviceLogger.warn('Failed to sync device time', timeErr);
      }

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
    if (this.client) {
      try {
        this.client.stopRealTimeLogs();
        await this.client.disconnect();
      } catch (e) {
        // ignore disconnect errors
      }
    }
    this.connected = false;
    this.emitStatusOnce('disconnected', 'Device disconnected');
  }

  async reconnect(): Promise<DeviceStatusPayload> {
    this.disposed = false;
    await this.disconnect();
    this.disposed = false; // ensure disposed is false so connect can start polling if needed
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
      return {
        ...status,
        userCount: info.userCount,
        attendanceCount: info.attendanceCount,
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
    return this.executeCommand(() => this.client.getDeviceInfo());
  }

  async getUsers(): Promise<DeviceUserPayload[]> {
    if (!this.connected) {
      await this.connect();
    }
    return this.executeSafeCommand(() => this.client.getUsers());
  }

  async getTemplates(): Promise<any[]> {
    if (!this.connected) {
      await this.connect();
    }
    return this.executeSafeCommand(() => this.client.getTemplates());
  }

  async getUserTemplates(userId: string | number, uid?: number): Promise<any[]> {
    if (!this.connected) {
      await this.connect();
    }

    return this.executeSafeCommand(async () => {
      const templates: any[] = [];
      const uidString = userId.toString();
      let deviceUid = uid;

      try {
        if (deviceUid === undefined) {
          // Find the user's internal UID first
          const usersRes = await this.client.getUsers();
          // zklib-ts might return an array directly or { data: [] }
          const usersList = Array.isArray(usersRes) ? usersRes : (usersRes as any).data || [];

          const deviceUser = usersList.find((u: any) =>
            u.userId === uidString || u.user_id === uidString || u.uid.toString() === uidString
          );

          if (!deviceUser) {
            deviceLogger.warn(`User ${uidString} not found when fetching templates`);
            return templates;
          }

          deviceUid = deviceUser.uid;

          // CRITICAL: Prevent socket buffer pollution from getUsers() by flushing the TCP stream.
          // Using freeData() is not enough on some devices (like K40). We must physically reconnect.
          await this.client.disconnect();
          await this.client.connect(this.settings);
        }

        const templatesRes = await this.client.getTemplates();
        const templatesList = Array.isArray(templatesRes) ? templatesRes : (templatesRes as any).data || [];

        for (const t of templatesList) {
          if (t.uid === deviceUid) {
            templates.push({
              fid: t.fid,
              valid: t.valid,
              size: t.size || t.template?.length || 0,
              template: t.template,
              uid: t.uid
            });
          }
        }
      } catch (err: any) {
        deviceLogger.error(`Failed to fetch templates for ${uidString}`, err);
      }

      return templates;
    });
  }

  async getUsersAndTemplates(): Promise<{ users: DeviceUserPayload[], templates: any[] }> {
    if (!this.connected) {
      await this.connect();
    }
    return this.executeSafeCommand(async () => {
      const users = await this.client.getUsers();

      // CRITICAL: Prevent socket buffer pollution from getUsers() by flushing the TCP stream.
      // Using freeData() is not enough on some devices (like K40). We must physically reconnect.
      await this.client.disconnect();
      await this.client.connect(this.settings);

      let templates: any[] = [];
      try {
        templates = await this.client.getTemplates();
      } catch (e) {
        deviceLogger.warn("Failed to get templates during getUsersAndTemplates", e);
      }
      return { users, templates };
    });
  }

  async getAttendance(): Promise<DeviceAttendancePayload[]> {
    if (!this.connected) {
      await this.connect();
    }
    return this.executeSafeCommand(() => this.client.getAttendance());
  }

  async addUser(user: DeviceUserPayload): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    try {
      await this.executeSafeCommand(() => this.client.addUser(user));
    } catch (error) {
      throw new DeviceError(toErrorMessage(error));
    }
  }

  async deleteFinger(uid: number, fid: number): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    try {
      // Use the newly added deleteFinger in ZKClient directly without polluting the socket
      await this.executeSafeCommand(() => (this.client as any).deleteFinger(uid, fid));
    } catch (error) {
      throw new DeviceError(toErrorMessage(error));
    }
  }

  async updateUser(user: DeviceUserPayload): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    try {
      // Resolve internal UID before updating
      const users = await this.getUsers();
      const targetUserId = String(user.userId ?? user.user_id ?? user.uid ?? user.employeeNo);
      const deviceUser = users.find((u: any) => String(u.user_id ?? u.uid ?? u.userId ?? u.employeeNo) === targetUserId);

      const payloadToUpdate = { ...user };
      if (deviceUser && typeof deviceUser.uid === 'number') {
        payloadToUpdate.uid = deviceUser.uid;
      }

      await this.executeSafeCommand(() => this.client.updateUser(payloadToUpdate));
    } catch (error) {
      throw new DeviceError(toErrorMessage(error));
    }
  }

  async deleteUser(userId: number): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    try {
      const users = await this.getUsers();
      const deviceUser = users.find((u: any) => String(u.user_id ?? u.uid ?? u.userId ?? u.employeeNo) === String(userId));

      let uidToDelete = Number(userId);
      if (deviceUser && deviceUser.uid != null) {
        uidToDelete = Number(deviceUser.uid);
      }

      await this.executeSafeCommand(() => this.client.deleteUser(uidToDelete));
    } catch (error) {
      throw new DeviceError(toErrorMessage(error));
    }
  }

  async clearAttendance(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    await this.executeSafeCommand(() => this.client.clearAttendance());
  }

  async restartDevice(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    await this.executeSafeCommand(() => this.client.restart());
  }

  async startEnrollment(userId: number | string, fingerIndex: number = 0): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    try {
      this.pendingEnrollments.set(Number(userId), fingerIndex);
      await this.executeSafeCommand(() => this.client.startEnrollment(userId, fingerIndex));
    } catch (error) {
      throw new DeviceError(toErrorMessage(error));
    }
  }


  /**
   * Process a real-time attendance event from the device.
   * The device pushes these immediately when a fingerprint is scanned.
   */
  private async processRealTimeAttendance(record: any): Promise<void> {
    const deviceUserId = Number(record.user_id ?? record.userId);
    if (Number.isNaN(deviceUserId)) return;

    const checkInTime = this.getLogTimestamp(record);
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
      } catch (err: any) {
        // P2002 = Prisma unique constraint violation (expected duplicate) — safe to ignore
        if (err?.code !== 'P2002') {
          deviceLogger.error('Failed to record device attendance log', err);
        }
      }
    }

    // Map to the DeviceAttendancePayload format the bridge expects
    const logItem: DeviceAttendancePayload = {
      deviceUserId,
      userId: deviceUserId,
      recordTime: checkInTime,
      attTime: checkInTime,
      exactTime: record.exactTime,
      method: "BIOMETRIC",
    };

    // Emit to bridge for processing
    this.emit('attendance', [logItem], false);

    // Auto-mark enrolled: if they checked in, they must have a fingerprint
    if (this.prisma) {
      try {
        await this.ensureFingerprintEnrolled(deviceUserId);
      } catch (err) {
        deviceLogger.error('Failed to auto-enroll fingerprint on check-in', err);
      }
    }

    deviceLogger.info("Real-time attendance event", {
      deviceUserId,
      checkInTime: checkInTime.toISOString(),
      exactTime: record.exactTime,
    });
  }

  /**
   * Called when a user successfully checks in, ensuring they have at least 1 fingerprint record.
   */
  private async ensureFingerprintEnrolled(deviceUserId: number): Promise<void> {
    if (!this.prisma) return;
    const member = await this.prisma.member.findFirst({ where: { employeeNo: deviceUserId } });

    let templateBuffer = Buffer.alloc(0);
    let templateSize = 0;
    let valid = 1;

    deviceLogger.info(`Auto-enroll check: skipping real template fetch for user ${deviceUserId} finger 0 to prevent socket timeout. Using empty buffer.`);

    if (member) {
      const existing = await this.prisma.fingerprint.findFirst({ where: { memberId: member.id } });
      if (!existing) {
        deviceLogger.info(`Auto-enrolling fingerprint for member ${member.id} based on check-in`);
        await this.prisma.fingerprint.create({
          data: { uid: deviceUserId, fid: 0, valid: valid, template: templateBuffer, size: templateSize, memberId: member.id }
        });
      }
    } else {
      const trainer = await this.prisma.trainer.findFirst({ where: { employeeNo: deviceUserId } });
      if (trainer) {
        const existing = await this.prisma.fingerprint.findFirst({ where: { trainerId: trainer.id } });
        if (!existing) {
          deviceLogger.info(`Auto-enrolling fingerprint for trainer ${trainer.id} based on check-in`);
          await this.prisma.fingerprint.create({
            data: { uid: deviceUserId, fid: 0, valid: valid, template: templateBuffer, size: templateSize, trainerId: trainer.id }
          });
        }
      }
    }
  }

  /**
   * Called by the real-time event hook when an EF_ENROLLUSER or EF_ENROLLFINGER event is received.
   * Increments the fingerprint count for the user.
   */
  public async addRealTimeFingerprint(userId: string): Promise<void> {
    if (!this.prisma) return;
    const deviceUserId = Number(userId);
    if (Number.isNaN(deviceUserId)) return;

    deviceLogger.info(`Real-time enrollment event received for user ${userId}`);

    const member = await this.prisma.member.findFirst({ where: { employeeNo: deviceUserId } });

    let templateBuffer = Buffer.alloc(0);
    let templateSize = 0;
    let valid = 1;

    // Check pending enrollments to find the target finger index, or fallback to count
    let existingCount = 0;
    if (member) {
      existingCount = await this.prisma.fingerprint.count({ where: { memberId: member.id } });
    } else {
      const trainer = await this.prisma.trainer.findFirst({ where: { employeeNo: deviceUserId } });
      if (trainer) {
        existingCount = await this.prisma.fingerprint.count({ where: { trainerId: trainer.id } });
      }
    }

    const targetFid = this.pendingEnrollments.get(deviceUserId) ?? existingCount;
    this.pendingEnrollments.delete(deviceUserId);

    try {
      deviceLogger.info(`Attempting to fetch real template for user ${deviceUserId} finger ${targetFid}`);
      // Safely fetch over a new connection to avoid real-time socket timeout
      const fingerData = await this.executeSafeCommand(() => this.client.getUserTemplate(deviceUserId.toString(), targetFid));
      if (fingerData && fingerData.template) {
        templateBuffer = fingerData.template;
        templateSize = fingerData.size ?? fingerData.template.length;
        valid = fingerData.valid ?? 1;
        deviceLogger.info(`Successfully fetched real template, size: ${templateSize}`);
      }
    } catch (err) {
      deviceLogger.warn(`Could not fetch real template for user ${deviceUserId} finger ${targetFid}. Using empty buffer instead of dummy text.`, err);
    }

    if (member) {
      const existing = await this.prisma.fingerprint.findFirst({
        where: { memberId: member.id, fid: targetFid }
      });
      if (existing) {
        await this.prisma.fingerprint.update({
          where: { id: existing.id },
          data: { template: templateBuffer, size: templateSize, valid: valid }
        });
      } else {
        await this.prisma.fingerprint.create({
          data: { uid: deviceUserId, fid: targetFid, valid: valid, template: templateBuffer, size: templateSize, memberId: member.id }
        });
      }
      deviceLogger.info(`Added/updated fingerprint #${targetFid} for member ${member.id}`);
    } else {
      const trainer = await this.prisma.trainer.findFirst({ where: { employeeNo: deviceUserId } });
      if (trainer) {
        const existing = await this.prisma.fingerprint.findFirst({
          where: { trainerId: trainer.id, fid: targetFid }
        });
        if (existing) {
          await this.prisma.fingerprint.update({
            where: { id: existing.id },
            data: { template: templateBuffer, size: templateSize, valid: valid }
          });
        } else {
          await this.prisma.fingerprint.create({
            data: { uid: deviceUserId, fid: targetFid, valid: valid, template: templateBuffer, size: templateSize, trainerId: trainer.id }
          });
        }
        deviceLogger.info(`Added/updated fingerprint #${targetFid} for trainer ${trainer.id}`);
      }
    }
  }

  /**
   * Extract the timestamp from a device attendance log item.
   * Returns a Date rounded to seconds for consistent dedup.
   */
  private getLogTimestamp(log: DeviceAttendancePayload, isPolling: boolean = false): Date {
    let raw = log.record_time ?? log.recordTime ?? log.timestamp ?? log.attTime ?? log.checkInTime ?? log.date;
    const now = new Date();
    if (raw == null) return roundToSeconds(now);

    let d: Date;
    if (typeof raw === 'string') {
      if (raw.endsWith('Z')) raw = raw.replace('Z', '');
      d = new Date(raw);
    } else if (raw instanceof Date) {
      if (isPolling) {
        // zklib-ts incorrectly treats device time as UTC during bulk sync.
        // We construct a new Date using its UTC values to enforce the local timezone.
        d = new Date(
          raw.getUTCFullYear(),
          raw.getUTCMonth(),
          raw.getUTCDate(),
          raw.getUTCHours(),
          raw.getUTCMinutes(),
          raw.getUTCSeconds()
        );
      } else {
        d = new Date(raw);
      }
    } else {
      d = new Date(raw);
    }

    if (Number.isNaN(d.getTime())) return roundToSeconds(now);

    // ZKTeco devices often send real-time logs with invalid years (e.g. 2005 or 2000)
    // If the date is absurdly old, assume it's a real-time log happening right now
    if (d.getFullYear() < 2020) {
      return roundToSeconds(now);
    }

    return roundToSeconds(d);
  }

  /**
   * Extract the device user ID from a log item.
   */
  private getLogDeviceUserId(log: DeviceAttendancePayload): number | null {
    const raw = log.user_id ?? log.userId ?? log.uid ?? log.deviceUserId ?? log.userSn;
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
    const checkInTime = this.getLogTimestamp(log, true);
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
      let watermarkTime: Date | null = null;

      if (this.prisma) {
        const latestDbTime = await getLastProcessedAttendanceTime({ prisma: this.prisma });
        if (latestDbTime) {
          // 24-hour buffer to account for out-of-order logs, timezone changes, etc.
          watermarkTime = new Date(latestDbTime.getTime() - 24 * 60 * 60 * 1000);
        }
      }

      // --- Batch dedup: fetch all existing logs in one query instead of N+1 ---
      let existingKeysSet = new Set<string>();
      if (this.prisma && watermarkTime) {
        try {
          const existingLogs = await this.prisma.deviceAttendanceLog.findMany({
            where: { checkInTime: { gte: watermarkTime } },
            select: { deviceUserId: true, checkInTime: true },
          });
          for (const el of existingLogs) {
            existingKeysSet.add(this.makeKey(el.deviceUserId, el.checkInTime));
          }
        } catch (err) {
          deviceLogger.warn('Failed to batch-query existing logs, falling back to per-log checks', err);
        }
      }

      for (const log of logs) {
        const deviceUserId = this.getLogDeviceUserId(log);
        if (deviceUserId == null) continue;

        const checkInTime = this.getLogTimestamp(log, true);
        log.record_time = checkInTime;
        log.recordTime = checkInTime;
        log.timestamp = checkInTime;

        // Fast-path memory skip based on watermark
        if (watermarkTime && checkInTime < watermarkTime) {
          continue;
        }

        // Check in-memory set first (fast)
        const key = this.makeKey(deviceUserId, checkInTime);
        if (this.processedKeys.has(key)) continue;

        // Check batch-loaded DB keys (single query, not N+1)
        if (existingKeysSet.has(key)) {
          this.processedKeys.add(key);
          continue;
        }

        unprocessedLogs.push(log);
        this.processedKeys.add(key);
      }

      // Evict oldest keys if processedKeys grows too large
      if (this.processedKeys.size > DeviceManager.MAX_PROCESSED_KEYS) {
        const excess = this.processedKeys.size - DeviceManager.MAX_PROCESSED_KEYS;
        const iter = this.processedKeys.values();
        for (let i = 0; i < excess; i++) {
          this.processedKeys.delete(iter.next().value!);
        }
      }

      // Emit events for the bridge to process
      if (unprocessedLogs.length > 0) {
        this.emit('attendance', unprocessedLogs, true);

        // Auto-mark enrolled for all unique users in this sync batch
        const uniqueUsers = Array.from(new Set(unprocessedLogs.map(l => this.getLogDeviceUserId(l)).filter((id): id is number => id != null)));
        for (const userId of uniqueUsers) {
          try {
            await this.ensureFingerprintEnrolled(userId);
          } catch (err) {
            deviceLogger.error(`Failed to auto-enroll fingerprint for ${userId} during bulk sync`, err);
          }
        }
      }

      // Batch-insert all processed logs in a single transaction
      if (this.prisma && unprocessedLogs.length > 0) {
        const upsertOps = unprocessedLogs.map((log) => {
          const deviceUserId = this.getLogDeviceUserId(log) ?? 0;
          const checkInTime = this.getLogTimestamp(log, true);
          const method = log.method ?? "BIOMETRIC";
          const normalizedTime = new Date(checkInTime);
          normalizedTime.setMilliseconds(0);

          return this.prisma.deviceAttendanceLog.upsert({
            where: {
              unique_device_attendance_time: {
                deviceUserId,
                checkInTime: normalizedTime,
                method,
              },
            },
            update: {},
            create: {
              deviceUserId,
              deviceLogId: log.deviceLogId ?? (log.id ? Number(log.id) : undefined),
              checkInTime: normalizedTime,
              method,
            },
          });
        });

        try {
          await this.prisma.$transaction(upsertOps);
        } catch (err) {
          // Individual duplicates are handled by upsert; log unexpected errors
          deviceLogger.warn('Batch attendance log insert warning', err);
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
          // After a fresh connect, always sync offline attendance
          await this.syncAttendance();
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
          if (!this.client.isSocketAlive()) {
            throw new Error("Socket is dead");
          }

          // Try starting real-time if not enabled yet
          if (!this.realtimeEnabled) {
            try {
              await this.client.startRealTimeLogs(
                (record) => {
                  this.processRealTimeAttendance(record).catch(err => deviceLogger.error('Real-time log error', err));
                },
                (userId) => {
                  this.addRealTimeFingerprint(userId).catch(err => deviceLogger.error('Real-time enroll error', err));
                }
              );
              this.realtimeEnabled = true;
              deviceLogger.info('Real-time event listener registered successfully');
            } catch (err) {
              deviceLogger.warn('Real-time event registration failed', err);
            }
          }
        } catch (err) {
          deviceLogger.error("Watchdog: Connection died, triggering reconnect", err);
          this.connected = false;
          this.realtimeEnabled = false;
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
      deviceName: 'ZKTeco K40',
    };
  }
}

export const deviceManager = new DeviceManager();
