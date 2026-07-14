"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/main.ts
var main_exports = {};
__export(main_exports, {
  prisma: () => prisma
});
module.exports = __toCommonJS(main_exports);
var import_electron3 = require("electron");
var import_path4 = __toESM(require("path"));
var import_client = require("@prisma/client");
var import_fs3 = __toESM(require("fs"));

// electron/handlers/auth.ts
var import_bcryptjs = __toESM(require("bcryptjs"));
function registerAuthHandlers(ipcMain2, prisma2) {
  ipcMain2.handle("auth:checkHasOwner", async () => {
    const count = await prisma2.owner.count();
    return count > 0;
  });
  ipcMain2.handle("auth:createInitialOwner", async (_, data) => {
    const count = await prisma2.owner.count();
    if (count > 0) throw new Error("Owner already exists");
    const hashedPassword = await import_bcryptjs.default.hash(data.password, 10);
    return await prisma2.owner.create({
      data: {
        username: data.username,
        password: hashedPassword
      }
    });
  });
  ipcMain2.handle("auth:login", async (_, credentials) => {
    const owner = await prisma2.owner.findUnique({
      where: { username: credentials.username }
    });
    if (!owner) throw new Error("Invalid credentials");
    const valid = await import_bcryptjs.default.compare(credentials.password, owner.password);
    if (!valid) throw new Error("Invalid credentials");
    const { password, ...safeOwner } = owner;
    return safeOwner;
  });
}

// electron/handlers/members.ts
var import_path2 = __toESM(require("path"));

// electron/zkTeco/DeviceManager.ts
var import_events = require("events");

// electron/zkTeco/constants.ts
var DEVICE_TYPE = "zkteco-k70";
var DEFAULT_DEVICE_SETTINGS = {
  enabled: false,
  deviceType: DEVICE_TYPE,
  ip: "",
  port: 4370,
  timeout: 1e4,
  pollInterval: 5e3
};
var COMMANDS = {
  CMD_ENABLEDEVICE: 1002,
  CMD_DISABLEDEVICE: 1003,
  CMD_RESTART: 1004,
  CMD_USER_WRQ: 8,
  CMD_DELETE_USER: 18,
  CMD_STARTENROLL: 61,
  CMD_CANCELCAPTURE: 62,
  CMD_DATA_WRRQ: 1503,
  CMD_CAPTUREFINGER: 1009,
  CMD_REFRESHDATA: 1013,
  CMD_CLEAR_ATTLOG: 15
};
var DEFAULT_RECONNECT_INTERVAL_MS = 1e4;
var DEFAULT_POLL_INTERVAL_MS = 5e3;

// electron/zkTeco/errors/DeviceError.ts
var DeviceError = class extends Error {
  constructor(message, code = "DEVICE_ERROR", details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "DeviceError";
  }
  code;
  details;
};

// electron/zkTeco/errors/ConnectionError.ts
var ConnectionError = class extends DeviceError {
  constructor(message, details) {
    super(message, "CONNECTION_ERROR", details);
    this.name = "ConnectionError";
  }
};

// electron/zkTeco/ZKClient.ts
var import_node_zklib = __toESM(require("node-zklib"));

// electron/zkTeco/DeviceLogger.ts
var DeviceLogger = class {
  log(level, message, details) {
    const prefix = "[ZKTECO]";
    const payload = details ? ` ${JSON.stringify(details)}` : "";
    const output = `${prefix} ${message}${payload}`;
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.info(output);
    }
  }
  info(message, details) {
    this.log("info", message, details);
  }
  warn(message, details) {
    this.log("warn", message, details);
  }
  error(message, details) {
    this.log("error", message, details);
  }
};
var deviceLogger = new DeviceLogger();

// electron/zkTeco/helpers/createUserPacket.ts
var import_buffer = require("buffer");
function createUserPacket(user) {
  const packet = import_buffer.Buffer.alloc(72);
  packet.writeUInt16LE(user.uid, 0);
  packet.writeUInt8(user.privilege ?? 0, 2);
  packet.write((user.password ?? "").substring(0, 8), 3, "ascii");
  packet.write(user.name.substring(0, 23), 11, "ascii");
  packet.writeUInt32LE(user.card ?? 0, 35);
  packet.writeUInt8(user.group ?? 1, 39);
  packet.writeUInt16LE(0, 40);
  packet.writeUInt16LE(0, 42);
  packet.writeUInt16LE(0, 44);
  packet.writeUInt16LE(0, 46);
  packet.write(String(user.userId).substring(0, 8), 48, "ascii");
  return packet;
}

// electron/zkTeco/helpers/createDeleteUserPacket.ts
function createDeleteUserPacket(uid) {
  const packet = Buffer.alloc(2);
  packet.writeUInt16LE(uid, 0);
  return packet;
}

// electron/zkTeco/ZKClient.ts
var ZKClient = class {
  client = null;
  commandQueue = [];
  isProcessing = false;
  isConnecting = false;
  isDisconnecting = false;
  connectionId = 0;
  async withTimeout(promise, ms = 5e3) {
    return Promise.race([
      promise,
      new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Operation timed out")), ms)
      )
    ]);
  }
  async processQueue() {
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
  queueCommand(cmd) {
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
  async connect(settings) {
    if (this.isConnecting) {
      throw new Error("Already connecting");
    }
    this.isConnecting = true;
    try {
      this.connectionId++;
      if (this.client) {
        try {
          await this.withTimeout(this.client.disconnect(), 3e3);
        } catch (err) {
          deviceLogger.warn("Disconnect timeout", err);
        } finally {
          this.client = null;
        }
      }
      this.commandQueue = [];
      this.client = new import_node_zklib.default(
        settings.ip,
        settings.port,
        settings.timeout,
        true
      );
      try {
        await this.withTimeout(
          this.client.createSocket(),
          settings.timeout + 2e3
        );
      } catch (error) {
        this.client = null;
        throw new Error(
          `Failed to connect to ZKTeco device: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      deviceLogger.info("Connected to ZKTeco device");
    } finally {
      this.isConnecting = false;
    }
  }
  async disconnect() {
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
        await this.withTimeout(this.client.disconnect(), 3e3);
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
  async testConnection() {
    if (!this.client) {
      throw new Error("Not connected to device");
    }
    return this.queueCommand(async () => {
      const status = await this.client.getSocketStatus?.();
      if (status !== void 0 && status !== null) {
        return status;
      }
      await this.withTimeout(this.client.getInfo(), 5e3);
      return true;
    });
  }
  async getDeviceInfo() {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const info = await this.withTimeout(
        this.client.getInfo(),
        1e4
      );
      return {
        model: info?.model ?? void 0,
        serialNumber: info?.serialNumber ?? void 0,
        firmwareVersion: info?.firmwareVersion ?? void 0,
        userCount: info?.userCount ?? void 0,
        attendanceCount: info?.attendanceCount ?? void 0,
        deviceName: "ZKTeco K70"
      };
    });
  }
  async getUsers() {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const res = await this.withTimeout(
        this.client.getUsers(),
        1e4
      );
      return res?.data ?? [];
    });
  }
  async getAttendance() {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      try {
        const response = await this.withTimeout(
          this.client.getAttendances(),
          15e3
        );
        const logs = Array.isArray(response?.data) ? response.data : [];
        deviceLogger.info("Fetched attendance logs from device", {
          count: logs.length,
          sampleLog: logs[0]
        });
        return logs;
      } catch (error) {
        throw new Error(
          `Failed to read attendance: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }
  async setUser(user) {
    return this.queueCommand(async () => {
      const packet = createUserPacket(user);
      await this.withTimeout(
        this.client.executeCmd(COMMANDS.CMD_DISABLEDEVICE),
        5e3
      );
      try {
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_USER_WRQ, packet),
          1e4
        );
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_REFRESHDATA),
          5e3
        );
      } catch (error) {
        throw new Error(
          `Failed to set user: ${error instanceof Error ? error.message : String(error)}`
        );
      } finally {
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_ENABLEDEVICE),
          5e3
        );
      }
    });
  }
  async addUser(user) {
    await this.setUser(user);
  }
  async updateUser(user) {
    await this.setUser(user);
  }
  async deleteUser(userId) {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const packet = createDeleteUserPacket(userId);
      await this.withTimeout(
        this.client.executeCmd(COMMANDS.CMD_DISABLEDEVICE),
        5e3
      );
      try {
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_DELETE_USER, packet),
          1e4
        );
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_REFRESHDATA),
          5e3
        );
      } finally {
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_ENABLEDEVICE),
          5e3
        );
      }
    });
  }
  async clearAttendance() {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      try {
        await this.withTimeout(this.client.clearAttendanceLog(), 1e4);
      } catch (error) {
        throw new Error(
          `Failed to clear attendance: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }
  async restart() {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      try {
        await this.withTimeout(
          this.client.executeCmd(COMMANDS.CMD_RESTART, Buffer.from("")),
          5e3
        );
      } catch (error) {
        throw new Error(
          `Failed to restart device: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }
  async executeCommand(cmd, payload) {
    if (!this.client || this.isDisconnecting || this.isConnecting) {
      throw new Error("Device is not ready");
    }
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      return await this.withTimeout(
        this.client.executeCmd(cmd, payload),
        1e4
      );
    });
  }
  async getTime() {
    if (!this.client) throw new Error("Not connected to device");
    return this.queueCommand(async () => {
      const time = await this.client.getTime();
      return time;
    });
  }
};

// electron/zkTeco/DeviceSettings.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var import_electron = require("electron");

// electron/zkTeco/utils.ts
function toErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const e = error;
    if (typeof e.message === "string") return e.message;
    if (typeof e.err === "string") return e.err;
    if (typeof e.err?.message === "string") return e.err.message;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return "Unknown device error";
}
function normalizeSettings(raw = {}) {
  const port = Number(raw.port ?? raw.httpPort ?? 4370);
  const timeout = Number(raw.timeout ?? 1e4);
  const pollInterval = Number(raw.pollInterval ?? 5e3);
  return {
    enabled: Boolean(raw.enabled),
    deviceType: raw.deviceType || "zkteco-k70",
    ip: String(raw.ip || "").trim(),
    port: Number.isFinite(port) ? port : 4370,
    timeout: Number.isFinite(timeout) ? timeout : 1e4,
    pollInterval: Number.isFinite(pollInterval) ? pollInterval : 5e3
  };
}
function createStructuredError(error) {
  if (error instanceof DeviceError) {
    return { success: false, error: error.message, code: error.code, details: error.details };
  }
  return { success: false, error: toErrorMessage(error), code: "DEVICE_ERROR" };
}

// electron/zkTeco/DeviceSettings.ts
var SETTINGS_FILENAME = "gymflow-zkteco-settings.json";
var DeviceSettingsStore = class {
  settingsPath;
  constructor() {
    this.settingsPath = import_path.default.join(import_electron.app.getPath("userData"), SETTINGS_FILENAME);
  }
  load() {
    try {
      if (import_fs.default.existsSync(this.settingsPath)) {
        const raw = import_fs.default.readFileSync(this.settingsPath, "utf-8");
        const parsed = JSON.parse(raw);
        return normalizeSettings({ ...DEFAULT_DEVICE_SETTINGS, ...parsed });
      }
    } catch {
    }
    return { ...DEFAULT_DEVICE_SETTINGS };
  }
  save(settings) {
    const merged = normalizeSettings({ ...this.load(), ...settings });
    import_fs.default.writeFileSync(this.settingsPath, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  }
  isConfigured(settings) {
    const resolved = settings ?? this.load();
    return Boolean(resolved.enabled && resolved.ip);
  }
};
var deviceSettingsStore = new DeviceSettingsStore();

// electron/zkTeco/DeviceManager.ts
var DeviceManager = class extends import_events.EventEmitter {
  client = new ZKClient();
  settings = deviceSettingsStore.load();
  connected = false;
  reconnectTimer = null;
  pollTimer = null;
  lastConnectedAt = null;
  lastAttendanceFingerprint = /* @__PURE__ */ new Set();
  isFirstPoll = true;
  isReconnecting = false;
  consecutiveFailures = 0;
  /** Tracks whether initial sync has been done */
  initialSyncDone = false;
  /** Tracks if we're in initial sync mode (polling disabled) */
  skipPolling = true;
  /** Tracks the last emitted status message to avoid duplicate status events */
  lastStatusEmitHash = null;
  /** Prevents timer callbacks from running after disconnect/cleanup */
  disposed = false;
  constructor() {
    super();
    this.setMaxListeners(20);
  }
  async applySettings(settings) {
    this.settings = deviceSettingsStore.save(settings);
    return this.settings;
  }
  getSettings() {
    this.settings = deviceSettingsStore.load();
    return { ...this.settings };
  }
  async connect() {
    if (!this.settings.enabled || !this.settings.ip) {
      throw new ConnectionError("Device is disabled or IP is not configured");
    }
    try {
      await this.client.connect(this.settings);
      this.connected = true;
      this.consecutiveFailures = 0;
      this.lastConnectedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.emitStatusOnce("connected", "Connected successfully");
      return this.buildStatus("connected", "Connected successfully");
    } catch (error) {
      this.connected = false;
      this.consecutiveFailures++;
      this.emitStatusOnce("offline", toErrorMessage(error));
      throw error;
    }
  }
  async disconnect() {
    this.disposed = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reconnectTimer) clearInterval(this.reconnectTimer);
    this.pollTimer = null;
    this.reconnectTimer = null;
    await this.client.disconnect();
    this.connected = false;
    this.emitStatusOnce("disconnected", "Device disconnected");
  }
  async reconnect() {
    await this.disconnect();
    return this.connect();
  }
  async testConnection() {
    try {
      const status = await this.connect();
      const info = await this.getDeviceInfo();
      try {
        deviceLogger.info("Device info retrieved", info);
      } catch {
      }
      const users = await this.getUsers();
      const attendance = await this.getAttendance();
      return {
        ...status,
        userCount: users.length,
        attendanceCount: attendance.length
      };
    } catch (error) {
      const message = toErrorMessage(error);
      return this.buildStatus("offline", message);
    }
  }
  isConnected() {
    return this.connected;
  }
  getStatus() {
    return this.buildStatus(
      this.connected ? "connected" : "offline",
      this.connected ? "Connected" : "Disconnected"
    );
  }
  async getDeviceInfo() {
    if (!this.connected) {
      await this.connect();
    }
    return this.client.getDeviceInfo();
  }
  async getUsers() {
    if (!this.connected) {
      await this.connect();
    }
    return this.client.getUsers();
  }
  async getAttendance() {
    if (!this.connected) {
      await this.connect();
    }
    return this.client.getAttendance();
  }
  async addUser(user) {
    if (!this.connected) {
      await this.connect();
    }
    try {
      await this.client.addUser(user);
    } catch (error) {
      throw new DeviceError(toErrorMessage(error));
    }
  }
  async updateUser(user) {
    if (!this.connected) {
      await this.connect();
    }
    try {
      await this.client.updateUser(user);
    } catch (error) {
      throw new DeviceError(toErrorMessage(error));
    }
  }
  async deleteUser(userId) {
    if (!this.connected) {
      await this.connect();
    }
    try {
      await this.client.deleteUser(userId);
    } catch (error) {
      throw new DeviceError(toErrorMessage(error));
    }
  }
  async clearAttendance() {
    if (!this.connected) {
      await this.connect();
    }
    await this.client.clearAttendance();
  }
  async restartDevice() {
    if (!this.connected) {
      await this.connect();
    }
    await this.client.restart();
  }
  /**
   * Poll the device for a user's fingerprint/templates until detected or timeout.
   * Returns true if templates were detected, false on timeout.
   */
  async waitForEnrollment(employeeNo, timeoutMs = 6e4, intervalMs = 2e3) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const users = await this.getUsers();
        const user = users.find((u) => {
          const uid = u.uid ?? u.userId ?? u.id ?? u.employeeNo ?? u.userid ?? u.cardNumber;
          return String(uid) === String(employeeNo);
        });
        if (user) {
          const hasTemplates = Array.isArray(user.templates) && user.templates.length > 0;
          const hasFingerprints = Array.isArray(user.fingerprints) && user.fingerprints.length > 0;
          const hasTemplateFields = Object.keys(user).some((k) => /template|finger|fp/i.test(k) && (Array.isArray(user[k]) ? user[k].length > 0 : Boolean(user[k])));
          if (hasTemplates || hasFingerprints || hasTemplateFields) return true;
        }
      } catch (err) {
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  }
  startAutoLifecycle() {
    const settings = this.getSettings();
    if (!settings.enabled || !settings.ip) return;
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
  async syncAttendance() {
    if (!this.connected) {
      try {
        await this.connect();
      } catch (error) {
        return { success: false, error: toErrorMessage(error) };
      }
    }
    try {
      const logs = await this.client.getAttendance();
      let logsToProcess;
      if (!this.initialSyncDone) {
        logsToProcess = logs;
        this.initialSyncDone = true;
        this.skipPolling = false;
      } else {
        logsToProcess = logs.filter((log) => {
          const key = `${log.userId ?? log.uid ?? log.deviceUserId ?? "unknown"}-${log.timestamp ?? log.attTime ?? ""}`;
          return !this.lastAttendanceFingerprint.has(key);
        });
      }
      if (logsToProcess.length > 0) {
        this.emit("attendance", logsToProcess, true);
      }
      for (const log of logsToProcess) {
        const key = `${log.userId ?? log.uid ?? log.deviceUserId ?? "unknown"}-${log.timestamp ?? log.attTime ?? ""}`;
        this.lastAttendanceFingerprint.add(key);
      }
      return { success: true, data: { total: logsToProcess.length } };
    } catch (error) {
      return { success: false, error: toErrorMessage(error) };
    }
  }
  /** On startup, connect to device only. The fingerprint set and polling are handled
   *  in syncAttendance() to ensure logs are processed when the renderer is ready. */
  async initializeAttendanceFingerprint() {
    try {
      if (!this.connected) {
        try {
          await this.connect();
        } catch {
          return;
        }
      }
      this.isFirstPoll = false;
    } catch {
    }
  }
  startPolling() {
    if (this.pollTimer) return;
    const interval = this.settings.pollInterval || DEFAULT_POLL_INTERVAL_MS;
    this.pollTimer = setInterval(async () => {
      if (this.disposed || !this.connected || this.skipPolling) return;
      try {
        const logs = await this.client.getAttendance();
        const newLogs = logs.filter((log) => {
          const key = `${log.userId ?? log.uid ?? log.deviceUserId ?? "unknown"}-${log.timestamp ?? log.attTime ?? ""}`;
          return !this.lastAttendanceFingerprint.has(key);
        });
        const updatedSet = /* @__PURE__ */ new Set();
        const existing = Array.from(this.lastAttendanceFingerprint);
        const toKeep = existing.slice(-500);
        for (const k of toKeep) updatedSet.add(k);
        for (const item of newLogs) {
          updatedSet.add(`${item.userId ?? item.uid ?? item.deviceUserId ?? "unknown"}-${item.timestamp ?? item.attTime ?? ""}`);
        }
        this.lastAttendanceFingerprint = updatedSet;
        if (newLogs.length > 0) {
          this.emit("attendance", newLogs, false);
        }
      } catch (error) {
        if (this.connected) {
          this.connected = false;
          this.consecutiveFailures++;
          this.emitStatusOnce("offline", toErrorMessage(error));
        }
      }
    }, interval);
  }
  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(async () => {
      if (this.disposed || !this.connected || this.isReconnecting) return;
      this.isReconnecting = true;
      try {
        const backoffMs = Math.min(
          1e3 * Math.pow(2, Math.min(this.consecutiveFailures, 10)),
          3e5
          // cap at 5 minutes
        );
        const now = Date.now();
        const lastFailure = this._lastFailureTime || 0;
        if (now - lastFailure < backoffMs) {
          return;
        }
        this._lastFailureTime = now;
        await this.connect();
      } catch {
      } finally {
        this.isReconnecting = false;
      }
    }, DEFAULT_RECONNECT_INTERVAL_MS);
  }
  /** Emits a status event only if the status message has changed, to prevent flickering */
  emitStatusOnce(status, message) {
    const hash = `${status}:${message}`;
    if (this.lastStatusEmitHash === hash) return;
    this.lastStatusEmitHash = hash;
    this.emit("status", this.buildStatus(status, message));
  }
  buildStatus(status, message) {
    return {
      connected: status === "connected",
      status,
      message,
      firmwareVersion: void 0,
      userCount: void 0,
      attendanceCount: void 0,
      lastConnectedAt: this.lastConnectedAt,
      deviceName: "ZKTeco K70"
    };
  }
};
var deviceManager = new DeviceManager();

// electron/zkTeco/membership/validateMembershipStateFromMember.ts
function validateMembershipStateFromMember(member) {
  const status = String(member?.status ?? "UNKNOWN").toUpperCase();
  if (!member) return "UNKNOWN";
  if (status === "ACTIVE") {
    if (member.membershipEnd) {
      const end = new Date(member.membershipEnd);
      if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
        return "EXPIRED";
      }
    }
    return "ACTIVE";
  }
  if (status === "EXPIRED") return "EXPIRED";
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "FROZEN") return "FROZEN";
  if (status === "PENDING") return "PENDING";
  if (status === "INACTIVE") return "BLOCKED";
  return "BLOCKED";
}

// electron/zkTeco/membership/validateCheckIn.ts
function validateCheckIn(member) {
  if (!member) {
    return { allowed: false, reason: "Member not found" };
  }
  const status = (member.status || "").toUpperCase();
  if (status === "LEAD") {
    return { allowed: true };
  }
  if (status !== "ACTIVE") {
    return { allowed: false, reason: `Member status is ${member.status}` };
  }
  if (!member.planId) {
    return { allowed: false, reason: "No active plan" };
  }
  if (member.membershipEnd) {
    const end = new Date(member.membershipEnd);
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
      return { allowed: false, reason: "Membership expired" };
    }
  }
  return { allowed: true };
}

// electron/zkTeco/membership/upsertAttendanceFromBiometric.ts
function getAttendanceTimestamp(logItem) {
  const raw = logItem.timestamp ?? logItem.attTime ?? logItem.checkInTime ?? logItem.checkTime ?? logItem.date;
  deviceLogger.info("Raw timestamp from device log", { raw, logItem });
  if (raw == null) {
    deviceLogger.warn("No timestamp found in log item, using current time");
    return /* @__PURE__ */ new Date();
  }
  let d;
  if (typeof raw === "number") {
    const ms = raw < 1e10 ? raw * 1e3 : raw;
    d = new Date(ms);
    deviceLogger.info("Parsed numeric timestamp", { raw, ms, parsed: d.toISOString() });
  } else if (typeof raw === "string") {
    d = new Date(raw);
    deviceLogger.info("Parsed string timestamp", { raw, parsed: d.toISOString() });
  } else {
    d = new Date(raw);
    deviceLogger.info("Parsed object timestamp", { parsed: d.toISOString() });
  }
  if (Number.isNaN(d.getTime())) {
    deviceLogger.warn("Failed to parse timestamp, using current time", { timestamp: raw });
    return /* @__PURE__ */ new Date();
  }
  return d;
}
function roundToSeconds(d) {
  const copy = new Date(d.getTime());
  copy.setMilliseconds(0);
  return copy;
}
async function upsertAttendanceFromBiometric(args) {
  const { prisma: prisma2, member, logItem, deviceUserId } = args;
  const now = roundToSeconds(/* @__PURE__ */ new Date());
  const checkInTime = roundToSeconds(getAttendanceTimestamp(logItem));
  deviceLogger.info("Processing attendance log", {
    deviceUserId,
    memberId: member.id,
    checkInTime: checkInTime.toISOString()
  });
  const nearDuplicate = await prisma2.attendance.findFirst({
    where: {
      memberId: member.id,
      checkInTime: {
        gte: new Date(checkInTime.getTime() - 1e3),
        lte: new Date(checkInTime.getTime() + 1e3)
      },
      method: "BIOMETRIC"
    }
  });
  if (nearDuplicate) {
    deviceLogger.info("Near-duplicate check-in skipped", {
      deviceUserId,
      memberId: member.id
    });
    return { ipcEvent: "attendance:checkin", attendance: nearDuplicate };
  }
  const created = await prisma2.attendance.create({
    data: {
      memberId: member.id,
      checkInTime,
      method: "BIOMETRIC"
    }
  });
  deviceLogger.info("Attendance checked in", {
    deviceUserId,
    memberId: member.id,
    checkInTime: checkInTime.toISOString()
  });
  return { ipcEvent: "attendance:checkin", attendance: created };
}

// electron/zkTeco/membership/upsertTrainerAttendanceFromBiometric.ts
function getAttendanceTimestamp2(logItem) {
  const raw = logItem.timestamp ?? logItem.attTime ?? logItem.checkInTime ?? logItem.checkTime ?? logItem.date;
  if (raw == null) {
    deviceLogger.warn("No timestamp found in log item, using current time", { logItem });
    return /* @__PURE__ */ new Date();
  }
  let d;
  if (typeof raw === "number") {
    const ms = raw < 1e10 ? raw * 1e3 : raw;
    d = new Date(ms);
  } else if (typeof raw === "string") {
    d = new Date(raw);
  } else {
    d = new Date(raw);
  }
  if (Number.isNaN(d.getTime())) {
    deviceLogger.warn("Failed to parse timestamp, using current time", { timestamp: raw, logItem });
    return /* @__PURE__ */ new Date();
  }
  return d;
}
function roundToSeconds2(d) {
  const copy = new Date(d.getTime());
  copy.setMilliseconds(0);
  return copy;
}
async function upsertTrainerAttendanceFromBiometric(args) {
  const { prisma: prisma2, trainer, logItem, deviceUserId } = args;
  const now = roundToSeconds2(/* @__PURE__ */ new Date());
  const checkInTime = roundToSeconds2(getAttendanceTimestamp2(logItem));
  deviceLogger.info("Processing trainer attendance log", {
    deviceUserId,
    trainerId: trainer.id,
    checkInTime: checkInTime.toISOString(),
    rawTimestamp: logItem.timestamp ?? logItem.attTime
  });
  const nearDuplicate = await prisma2.trainerAttendance.findFirst({
    where: {
      trainerId: trainer.id,
      checkInTime: {
        gte: new Date(checkInTime.getTime() - 1e3),
        lte: new Date(checkInTime.getTime() + 1e3)
      },
      method: "BIOMETRIC"
    }
  });
  if (nearDuplicate) {
    deviceLogger.info("Near-duplicate check-in skipped", {
      deviceUserId,
      trainerId: trainer.id
    });
    return { ipcEvent: "trainerAttendance:checkin", attendance: nearDuplicate };
  }
  const created = await prisma2.trainerAttendance.create({
    data: {
      trainerId: trainer.id,
      checkInTime,
      method: "BIOMETRIC"
    }
  });
  deviceLogger.info("Trainer attendance checked in", {
    deviceUserId,
    trainerId: trainer.id,
    checkInTime: checkInTime.toISOString()
  });
  return { ipcEvent: "trainerAttendance:checkin", attendance: created };
}

// electron/zkTeco/DeviceAttendanceBridge.ts
var TRAINER_ID_THRESHOLD = 1e4;
function registerDeviceAttendanceBridge(args) {
  const { prisma: prisma2, getMemberByDeviceUserId, getTrainerByDeviceUserId, getMainWindow: getMainWindow2, log } = args;
  const sendToRenderer = (channel, data) => {
    getMainWindow2()?.webContents.send(channel, data);
  };
  async function fetchDeviceUser(deviceUserId) {
    try {
      const users = await deviceManager.getUsers();
      return users.find((u) => {
        const uid = String(u.uid ?? u.userId ?? u.id ?? u.employeeNo ?? u.userid);
        return uid === String(deviceUserId);
      }) ?? null;
    } catch (err) {
      deviceLogger.error("Failed to fetch device user for auto-sync", {
        deviceUserId,
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  }
  async function fetchFullMember(memberId) {
    try {
      return await prisma2.member.findUnique({
        where: { id: memberId },
        include: { plan: true, trainer: true }
      });
    } catch {
      return null;
    }
  }
  async function autoCreateMemberFromDevice(deviceUserId, deviceUser) {
    try {
      const name = deviceUser.name ?? deviceUser.fullName ?? deviceUser.firstName ?? `Member-${deviceUserId}`;
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || `Member-${deviceUserId}`;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
      const member = await prisma2.member.create({
        data: {
          firstName,
          lastName,
          employeeNo: deviceUserId,
          deviceSynced: true,
          status: "ACTIVE"
        }
      });
      deviceLogger.info("Auto-created member from device sync", {
        memberId: member.id,
        deviceUserId,
        name
      });
      sendToRenderer("member:auto-created", {
        member,
        deviceUserId,
        deviceName: name
      });
      return member;
    } catch (err) {
      deviceLogger.error("Failed to auto-create member", {
        deviceUserId,
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  }
  async function autoCreateTrainerFromDevice(deviceUserId, deviceUser) {
    try {
      const name = deviceUser.name ?? deviceUser.fullName ?? deviceUser.firstName ?? `Trainer-${deviceUserId}`;
      const nameParts = name.trim().split(/\s+/);
      const firstName = nameParts[0] || `Trainer-${deviceUserId}`;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
      const trainer = await prisma2.trainer.create({
        data: {
          firstName,
          lastName,
          employeeNo: deviceUserId,
          deviceSynced: true
        }
      });
      deviceLogger.info("Auto-created trainer from device sync", {
        trainerId: trainer.id,
        deviceUserId,
        name
      });
      sendToRenderer("trainer:auto-created", {
        trainer,
        deviceUserId,
        deviceName: name
      });
      return trainer;
    } catch (err) {
      deviceLogger.error("Failed to auto-create trainer", {
        deviceUserId,
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  }
  deviceManager.on("attendance", async (newLogs, silent = false) => {
    try {
      for (const logItem of newLogs) {
        const deviceUserIdRaw = logItem.userId ?? logItem.deviceUserId ?? logItem.uid ?? null;
        const deviceUserId = deviceUserIdRaw == null ? null : Number(deviceUserIdRaw);
        if (!deviceUserId || Number.isNaN(deviceUserId)) {
          sendToRenderer("attendance:unknown", {
            reason: "missing-device-user-id",
            deviceUserId: deviceUserIdRaw,
            deviceLog: logItem,
            startupSync: silent
          });
          continue;
        }
        if (deviceUserId >= TRAINER_ID_THRESHOLD) {
          let trainer = await getTrainerByDeviceUserId(deviceUserId);
          if (!trainer) {
            const deviceUser = await fetchDeviceUser(deviceUserId);
            if (deviceUser) {
              trainer = await autoCreateTrainerFromDevice(deviceUserId, deviceUser);
            }
          }
          if (!trainer) {
            sendToRenderer("attendance:unknown", {
              deviceUserId,
              deviceLog: logItem,
              startupSync: silent
            });
            continue;
          }
          const result2 = await upsertTrainerAttendanceFromBiometric({
            prisma: prisma2,
            trainer,
            deviceUserId,
            logItem
          });
          sendToRenderer(result2.ipcEvent, {
            trainer,
            deviceUserId,
            attendance: result2.attendance,
            deviceLog: logItem,
            startupSync: silent
          });
          deviceLogger.info("Trainer attendance bridged", {
            ipcEvent: result2.ipcEvent,
            trainerId: trainer.id,
            deviceUserId,
            startupSync: silent
          });
          continue;
        }
        let member = await getMemberByDeviceUserId(deviceUserId);
        if (!member) {
          const deviceUser = await fetchDeviceUser(deviceUserId);
          if (deviceUser) {
            member = await autoCreateMemberFromDevice(deviceUserId, deviceUser);
          }
        }
        if (!member) {
          sendToRenderer("attendance:unknown", {
            deviceUserId,
            deviceLog: logItem,
            startupSync: silent
          });
          continue;
        }
        const state = validateMembershipStateFromMember(member);
        const checkInValidation = validateCheckIn(member);
        if (!checkInValidation.allowed) {
          const fullMember = await fetchFullMember(member.id);
          if (state === "EXPIRED") {
            sendToRenderer("attendance:expired", {
              member: fullMember || member,
              memberId: member.id,
              deviceUserId,
              state,
              reason: checkInValidation.reason,
              deviceLog: logItem,
              startupSync: silent
            });
          } else {
            sendToRenderer("attendance:inactive", {
              member: fullMember || member,
              memberId: member.id,
              deviceUserId,
              state,
              reason: checkInValidation.reason,
              deviceLog: logItem,
              startupSync: silent
            });
          }
          continue;
        }
        const result = await upsertAttendanceFromBiometric({
          prisma: prisma2,
          member,
          deviceUserId,
          logItem
        });
        sendToRenderer(result.ipcEvent, {
          member,
          deviceUserId,
          attendance: result.attendance,
          membershipState: state,
          deviceLog: logItem,
          startupSync: silent
        });
        deviceLogger.info("Attendance bridged", {
          ipcEvent: result.ipcEvent,
          memberId: member.id,
          deviceUserId,
          startupSync: silent
        });
      }
    } catch (error) {
      deviceLogger.error("DeviceAttendanceBridge failed", {
        error: error?.message
      });
      log?.("DeviceAttendanceBridge failed", { error: error?.message });
    }
  });
  deviceManager.on("status", (status) => {
    try {
      sendToRenderer("device:status", status);
    } catch {
    }
  });
}

// electron/zkTeco/ipc/device.ipc.ts
function registerZkTecoDeviceHandlers(ipcMain2, prisma2, getMainWindow2) {
  ipcMain2.handle("device:get-settings", async () => {
    return { success: true, data: deviceManager.getSettings() };
  });
  ipcMain2.handle("device:save-settings", async (_event, settings) => {
    try {
      const saved = await deviceManager.applySettings(settings);
      await deviceManager.disconnect();
      if (saved.enabled && saved.ip) {
        deviceManager.startAutoLifecycle();
      }
      return { success: true, data: saved };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:get-status", async () => {
    const settings = deviceManager.getSettings();
    if (!settings.enabled || !settings.ip) {
      return { success: true, data: { connected: false, status: "offline", message: "Device is disabled or not configured" } };
    }
    return { success: true, data: deviceManager.getStatus() };
  });
  ipcMain2.handle("device:test-connection", async () => {
    try {
      const result = await deviceManager.testConnection();
      const success = Boolean(result && result.connected);
      return { success, data: result, error: success ? void 0 : result.message };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:get-users", async () => {
    try {
      const users = await deviceManager.getUsers();
      return { success: true, data: users };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:get-attendance", async () => {
    try {
      const attendance = await deviceManager.getAttendance();
      return { success: true, data: attendance };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:add-user", async (_event, payload) => {
    try {
      await deviceManager.addUser(payload);
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:update-user", async (_event, payload) => {
    try {
      await deviceManager.updateUser(payload);
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:delete-user", async (_event, userId) => {
    try {
      await deviceManager.deleteUser(userId);
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:clear-attendance", async () => {
    try {
      await deviceManager.clearAttendance();
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:restart", async () => {
    try {
      await deviceManager.restartDevice();
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:connect", async () => {
    try {
      const status = await deviceManager.connect();
      return { success: true, data: status };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:disconnect", async () => {
    try {
      await deviceManager.disconnect();
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:reconnect", async () => {
    try {
      const status = await deviceManager.reconnect();
      return { success: true, data: status };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:listen", async () => {
    try {
      deviceManager.startAutoLifecycle();
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:stopListen", async () => {
    try {
      await deviceManager.disconnect();
      return { success: true };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:get-config", async () => {
    return { success: true, data: deviceManager.getSettings() };
  });
  ipcMain2.handle("device:configure", async (_event, settings) => {
    try {
      const saved = await deviceManager.applySettings(settings);
      return { success: true, data: saved };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:sync-users", async () => {
    try {
      const deviceUsers = await deviceManager.getUsers();
      let membersCreated = 0;
      let trainersCreated = 0;
      let membersSkipped = 0;
      let trainersSkipped = 0;
      for (const deviceUser of deviceUsers) {
        const deviceUserIdRaw = deviceUser.userId ?? deviceUser.uid ?? deviceUser.employeeNo;
        const deviceUserId = deviceUserIdRaw == null ? null : Number(deviceUserIdRaw);
        if (!deviceUserId || Number.isNaN(deviceUserId)) continue;
        const name = deviceUser.name ?? deviceUser.fullName ?? deviceUser.firstName ?? `User-${deviceUserId}`;
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || `User-${deviceUserId}`;
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
        if (deviceUserId >= 1e4) {
          const existing = await prisma2.trainer.findFirst({ where: { employeeNo: deviceUserId } });
          if (existing) {
            trainersSkipped++;
            continue;
          }
          await prisma2.trainer.create({
            data: { firstName, lastName, employeeNo: deviceUserId, deviceSynced: true }
          });
          trainersCreated++;
        } else {
          const existing = await prisma2.member.findFirst({ where: { employeeNo: deviceUserId } });
          if (existing) {
            membersSkipped++;
            continue;
          }
          await prisma2.member.create({
            data: { firstName, lastName, employeeNo: deviceUserId, deviceSynced: true, status: "ACTIVE" }
          });
          membersCreated++;
        }
      }
      return {
        success: true,
        data: {
          totalOnDevice: deviceUsers.length,
          membersCreated,
          trainersCreated,
          membersSkipped,
          trainersSkipped
        }
      };
    } catch (error) {
      return createStructuredError(error);
    }
  });
  ipcMain2.handle("device:sync-attendance", async () => {
    return deviceManager.syncAttendance();
  });
}

// electron/utils/deviceLogger.ts
var LOG_PREFIX = "[ZKTECO]";
function formatTimestamp() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function formatMessage(level, message, meta) {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `${formatTimestamp()} ${LOG_PREFIX} [${level}] ${message}${metaStr}`;
}
var deviceLogger2 = {
  info(message, meta) {
    console.log(formatMessage("INFO", message, meta));
  },
  warn(message, meta) {
    console.warn(formatMessage("WARN", message, meta));
  },
  error(message, meta) {
    console.error(formatMessage("ERROR", message, meta));
  },
  debug(message, meta) {
    if (process.env.NODE_ENV === "development") {
      console.log(formatMessage("DEBUG", message, meta));
    }
  },
  /** Log a successful device connection */
  connected(ip, model) {
    this.info("Connected to device", { ip, model });
  },
  /** Log a failed connection attempt */
  connectionFailed(ip, error) {
    this.error("Failed to connect to device", { ip, error });
  },
  /** Log user creation on device */
  userCreated(employeeNo, name) {
    this.info("User created on device", { employeeNo, name });
  },
  /** Log user creation failure */
  userCreateFailed(employeeNo, name, error) {
    this.error("Failed to create user on device", { employeeNo, name, error });
  },
  /** Log user search */
  userSearched(count) {
    this.info("User search completed", { resultCount: count });
  },
  /** Log sync operation */
  syncCompleted(matched, missingOnDevice, extraOnDevice) {
    this.info("Sync completed", { matched, missingOnDevice, extraOnDevice });
  },
  /** Log attendance event */
  attendanceReceived(employeeNo, time) {
    this.info("Attendance event received", { employeeNo, time });
  },
  /** Log an API request for debugging */
  apiRequest(method, path5) {
    this.debug(`${method} ${path5}`);
  },
  /** Log an API response for debugging */
  apiResponse(method, path5, status) {
    this.debug(`${method} ${path5} \u2192 ${status}`);
  }
};

// electron/handlers/members.ts
function formatDeviceDate(date) {
  if (!date) return void 0;
  try {
    return new Date(date).toISOString().split(".")[0];
  } catch {
    return void 0;
  }
}
function registerMembersHandlers(ipcMain2, prisma2, userDataPath) {
  ipcMain2.handle("members:getAll", async () => {
    const now = /* @__PURE__ */ new Date();
    const expiredMembers = await prisma2.member.findMany({
      where: {
        status: "ACTIVE",
        membershipEnd: { lt: now }
      },
      select: { id: true, employeeNo: true, firstName: true, lastName: true }
    });
    if (expiredMembers.length > 0) {
      await prisma2.member.updateMany({
        where: {
          status: "ACTIVE",
          membershipEnd: { lt: now }
        },
        data: { status: "EXPIRED" }
      });
      for (const m of expiredMembers) {
        if (m.employeeNo) {
          const name = `${m.firstName} ${m.lastName || ""}`.trim();
          try {
            await deviceManager.updateUser({
              userId: m.employeeNo,
              name,
              enabled: false
            });
            deviceLogger2.info("Auto-disabled expired member on device", {
              employeeNo: m.employeeNo,
              name
            });
          } catch (err) {
            deviceLogger2.error(
              "Failed to auto-disable expired member on device",
              {
                employeeNo: m.employeeNo,
                error: err.message
              }
            );
          }
        }
      }
    }
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1e3);
    await prisma2.member.updateMany({
      where: {
        status: "EXPIRED",
        membershipEnd: { lt: sixtyDaysAgo }
      },
      data: { status: "SUSPENDED" }
    });
    return await prisma2.member.findMany({
      include: {
        trainer: true,
        plan: true
      },
      orderBy: { createdAt: "desc" }
    });
  });
  ipcMain2.handle("members:getById", async (_, id) => {
    return await prisma2.member.findUnique({
      where: { id },
      include: {
        trainer: true,
        plan: true,
        attendances: {
          orderBy: { checkInTime: "desc" },
          take: 10
        }
      }
    });
  });
  ipcMain2.handle("members:create", async (_, data) => {
    const isActive = data.status === "ACTIVE";
    let nextEmployeeNo = null;
    if (isActive) {
      const lastMember = await prisma2.member.findFirst({
        where: { employeeNo: { not: null } },
        orderBy: { employeeNo: "desc" },
        select: { employeeNo: true }
      });
      nextEmployeeNo = (lastMember?.employeeNo || 0) + 1;
    }
    let member;
    try {
      member = await prisma2.member.create({
        data: {
          ...data,
          employeeNo: nextEmployeeNo,
          deviceSynced: false
        }
      });
    } catch (err) {
      if (err && err.code === "P2002") {
        throw new Error(
          "A member with the provided unique field already exists (CNIC or other)"
        );
      }
      throw err;
    }
    let deviceSynced = false;
    let deviceError;
    if (!isActive) {
      return {
        ...member,
        deviceSynced: false,
        deviceError: void 0
      };
    }
    const memberName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
    try {
      const userPayload = {
        uid: nextEmployeeNo,
        id: nextEmployeeNo,
        userId: nextEmployeeNo,
        employeeNo: nextEmployeeNo,
        name: memberName,
        fullName: memberName,
        firstName: data.firstName,
        lastName: data.lastName,
        privilege: 0,
        password: "",
        enabled: true,
        startDate: formatDeviceDate(data.membershipStart),
        endDate: formatDeviceDate(data.membershipEnd)
      };
      await deviceManager.addUser(userPayload);
      deviceSynced = true;
      (async () => {
        try {
          deviceLogger2.info("Waiting for fingerprint enrollment on device", {
            employeeNo: nextEmployeeNo
          });
          const enrolled = await deviceManager.waitForEnrollment(
            nextEmployeeNo,
            3e5,
            5e3
          );
          if (enrolled) {
            deviceLogger2.info("Fingerprint enrolled for user on device", {
              employeeNo: nextEmployeeNo
            });
            try {
              await prisma2.member.update({
                where: { id: member.id },
                data: { deviceSynced: true }
              });
            } catch {
            }
          } else {
            deviceLogger2.warn("Fingerprint enrollment timed out", {
              employeeNo: nextEmployeeNo
            });
          }
        } catch (err) {
          deviceLogger2.error("Error while waiting for enrollment", {
            employeeNo: nextEmployeeNo,
            error: err?.message
          });
        }
      })().catch((err) => {
        deviceLogger2.error("Unhandled error in enrollment watcher", {
          employeeNo: nextEmployeeNo,
          error: err?.message
        });
      });
      await prisma2.member.update({
        where: { id: member.id },
        data: { deviceSynced: true }
      });
      deviceLogger2.userCreated(nextEmployeeNo, memberName);
    } catch (error) {
      const msg = String(error?.message || error);
      if (msg.includes("User enrollment is not supported") || msg.includes("User enrollment is not implemented")) {
        deviceError = "Remote enrollment not supported by device/library. Please create user with ID " + nextEmployeeNo + " on the device and enroll fingerprint; the app will detect it automatically.";
        deviceLogger2.userCreateFailed(nextEmployeeNo, memberName, msg);
        (async () => {
          try {
            deviceLogger2.info(
              "Waiting for manual fingerprint enrollment on device",
              { employeeNo: nextEmployeeNo }
            );
            const enrolled = await deviceManager.waitForEnrollment(
              nextEmployeeNo,
              12e4,
              2e3
            );
            if (enrolled) {
              deviceLogger2.info(
                "Manual fingerprint enrolled for user on device",
                { employeeNo: nextEmployeeNo }
              );
              try {
                await prisma2.member.update({
                  where: { id: member.id },
                  data: { deviceSynced: true }
                });
              } catch {
              }
            } else {
              deviceLogger2.warn("Manual fingerprint enrollment timed out", {
                employeeNo: nextEmployeeNo
              });
            }
          } catch (err) {
            deviceLogger2.error("Error while waiting for manual enrollment", {
              employeeNo: nextEmployeeNo,
              error: err?.message
            });
          }
        })().catch((err) => {
          deviceLogger2.error("Unhandled error in manual enrollment watcher", {
            employeeNo: nextEmployeeNo,
            error: err?.message
          });
        });
      } else {
        deviceError = msg;
        deviceLogger2.userCreateFailed(nextEmployeeNo, memberName, msg);
      }
    }
    return {
      ...member,
      deviceSynced,
      deviceError
    };
  });
  ipcMain2.handle("members:update", async (_, id, data) => {
    let member = await prisma2.member.update({
      where: { id },
      data
    });
    if (member.status === "ACTIVE" && !member.employeeNo) {
      const lastMember = await prisma2.member.findFirst({
        where: { employeeNo: { not: null } },
        orderBy: { employeeNo: "desc" },
        select: { employeeNo: true }
      });
      const nextEmployeeNo = (lastMember?.employeeNo || 0) + 1;
      member = await prisma2.member.update({
        where: { id },
        data: { employeeNo: nextEmployeeNo }
      });
      try {
        const memberName = `${member.firstName || ""} ${member.lastName || ""}`.trim();
        await deviceManager.addUser({
          uid: nextEmployeeNo,
          id: nextEmployeeNo,
          userId: nextEmployeeNo,
          employeeNo: nextEmployeeNo,
          name: memberName,
          fullName: memberName,
          firstName: member.firstName,
          lastName: member.lastName,
          privilege: 0,
          password: "",
          startDate: formatDeviceDate(member.membershipStart),
          endDate: formatDeviceDate(member.membershipEnd)
        });
        await prisma2.member.update({
          where: { id: member.id },
          data: { deviceSynced: true }
        });
        deviceLogger2.info("Assigned ID and synced upgraded member to device", { employeeNo: nextEmployeeNo });
      } catch (error) {
        deviceLogger2.error("Failed to create upgraded member on device", { error: error.message });
      }
    }
    if (member.employeeNo) {
      try {
        const memberName = `${member.firstName || ""} ${member.lastName || ""}`.trim();
        const isExpired = member.membershipEnd && new Date(member.membershipEnd) < /* @__PURE__ */ new Date();
        const shouldEnable = member.status === "ACTIVE" && !isExpired;
        await deviceManager.updateUser({
          userId: member.employeeNo,
          name: memberName,
          enabled: shouldEnable,
          endDate: formatDeviceDate(member.membershipEnd)
        });
        deviceLogger2.info("Synced member update to device", {
          employeeNo: member.employeeNo,
          enabled: shouldEnable
        });
      } catch (error) {
        deviceLogger2.error("Failed to update user on device", {
          employeeNo: member.employeeNo,
          error: error.message
        });
      }
    }
    return member;
  });
  ipcMain2.handle("members:delete", async (_, id) => {
    const member = await prisma2.member.findUnique({
      where: { id },
      select: { id: true, employeeNo: true, firstName: true, lastName: true }
    });
    if (!member) {
      throw new Error("Member not found");
    }
    if (member.employeeNo) {
      try {
        await deviceManager.deleteUser(member.employeeNo);
        deviceLogger2.info("Deleted member from device", {
          employeeNo: member.employeeNo,
          name: `${member.firstName} ${member.lastName || ""}`.trim()
        });
      } catch (error) {
        deviceLogger2.error("Failed to delete user from device", {
          employeeNo: member.employeeNo,
          error: error.message
        });
      }
    }
    return await prisma2.member.delete({
      where: { id }
    });
  });
  ipcMain2.handle("members:getPhotoPath", async (_, filename) => {
    return import_path2.default.join(userDataPath, "media", filename);
  });
  ipcMain2.handle("members:getDeviceSyncStatus", async () => {
    try {
      const deviceUsers = await deviceManager.getUsers();
      const deviceUsersMap = /* @__PURE__ */ new Map();
      for (const u of deviceUsers) {
        const uid = Number(u.uid ?? u.userId);
        if (!Number.isNaN(uid)) {
          deviceUsersMap.set(uid, u);
        }
      }
      const members = await prisma2.member.findMany({
        select: { id: true, employeeNo: true, deviceSynced: true, firstName: true, lastName: true }
      });
      const updatedStatus = [];
      for (const m of members) {
        const onDevice = m.employeeNo != null ? deviceUsersMap.has(m.employeeNo) : false;
        updatedStatus.push({
          id: m.id,
          employeeNo: m.employeeNo,
          deviceSynced: m.deviceSynced,
          onDevice
        });
      }
      return {
        success: true,
        data: updatedStatus
      };
    } catch (error) {
      return { success: false, data: [] };
    }
  });
}

// electron/handlers/trainers.ts
var TRAINER_ID_OFFSET = 1e4;
function registerTrainersHandlers(ipcMain2, prisma2) {
  ipcMain2.handle("trainers:getAll", async () => {
    return await prisma2.trainer.findMany({
      include: {
        _count: {
          select: { members: true }
        },
        members: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            status: true,
            plan: { select: { name: true } }
          },
          orderBy: { firstName: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  });
  ipcMain2.handle("trainers:create", async (_, data) => {
    const lastTrainer = await prisma2.trainer.findFirst({
      where: { employeeNo: { not: null } },
      orderBy: { employeeNo: "desc" },
      select: { employeeNo: true }
    });
    const lastTrainerNo = lastTrainer?.employeeNo || TRAINER_ID_OFFSET;
    const nextEmployeeNo = lastTrainerNo + 1;
    let trainer;
    try {
      trainer = await prisma2.trainer.create({
        data: {
          ...data,
          employeeNo: nextEmployeeNo,
          deviceSynced: false
        }
      });
    } catch (err) {
      if (err && err.code === "P2002") {
        throw new Error(
          "A trainer with the provided unique field already exists (CNIC or other)"
        );
      }
      throw err;
    }
    let deviceSynced = false;
    let deviceError;
    const trainerName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
    try {
      const userPayload = {
        uid: nextEmployeeNo,
        id: nextEmployeeNo,
        userId: nextEmployeeNo,
        employeeNo: nextEmployeeNo,
        name: trainerName,
        fullName: trainerName,
        firstName: data.firstName,
        lastName: data.lastName,
        privilege: 0,
        password: ""
      };
      await deviceManager.addUser(userPayload);
      deviceSynced = true;
      (async () => {
        try {
          deviceLogger2.info("Waiting for fingerprint enrollment on device for trainer", {
            employeeNo: nextEmployeeNo
          });
          const enrolled = await deviceManager.waitForEnrollment(
            nextEmployeeNo,
            3e5,
            5e3
          );
          if (enrolled) {
            deviceLogger2.info("Fingerprint enrolled for trainer on device", {
              employeeNo: nextEmployeeNo
            });
            try {
              await prisma2.trainer.update({
                where: { id: trainer.id },
                data: { deviceSynced: true }
              });
            } catch {
            }
          } else {
            deviceLogger2.warn("Fingerprint enrollment timed out for trainer", {
              employeeNo: nextEmployeeNo
            });
          }
        } catch (err) {
          deviceLogger2.error("Error while waiting for trainer enrollment", {
            employeeNo: nextEmployeeNo,
            error: err?.message
          });
        }
      })().catch((err) => {
        deviceLogger2.error("Unhandled error in trainer enrollment watcher", {
          employeeNo: nextEmployeeNo,
          error: err?.message
        });
      });
      await prisma2.trainer.update({
        where: { id: trainer.id },
        data: { deviceSynced: true }
      });
      deviceLogger2.userCreated(nextEmployeeNo, trainerName);
    } catch (error) {
      const msg = String(error?.message || error);
      if (msg.includes("User enrollment is not supported") || msg.includes("User enrollment is not implemented")) {
        deviceError = "Remote enrollment not supported by device/library. Please create user with ID " + nextEmployeeNo + " on the device and enroll fingerprint; the app will detect it automatically.";
        deviceLogger2.userCreateFailed(nextEmployeeNo, trainerName, msg);
        (async () => {
          try {
            deviceLogger2.info(
              "Waiting for manual fingerprint enrollment for trainer on device",
              { employeeNo: nextEmployeeNo }
            );
            const enrolled = await deviceManager.waitForEnrollment(
              nextEmployeeNo,
              12e4,
              2e3
            );
            if (enrolled) {
              deviceLogger2.info(
                "Manual fingerprint enrolled for trainer on device",
                { employeeNo: nextEmployeeNo }
              );
              try {
                await prisma2.trainer.update({
                  where: { id: trainer.id },
                  data: { deviceSynced: true }
                });
              } catch {
              }
            } else {
              deviceLogger2.warn("Manual fingerprint enrollment timed out for trainer", {
                employeeNo: nextEmployeeNo
              });
            }
          } catch (err) {
            deviceLogger2.error("Error while waiting for manual trainer enrollment", {
              employeeNo: nextEmployeeNo,
              error: err?.message
            });
          }
        })().catch((err) => {
          deviceLogger2.error("Unhandled error in manual trainer enrollment watcher", {
            employeeNo: nextEmployeeNo,
            error: err?.message
          });
        });
      } else {
        deviceError = msg;
        deviceLogger2.userCreateFailed(nextEmployeeNo, trainerName, msg);
      }
    }
    return {
      ...trainer,
      deviceSynced,
      deviceError
    };
  });
  ipcMain2.handle("trainers:update", async (_, id, data) => {
    let trainer = await prisma2.trainer.update({
      where: { id },
      data
    });
    if (!trainer.employeeNo) {
      const lastTrainer = await prisma2.trainer.findFirst({
        where: { employeeNo: { not: null } },
        orderBy: { employeeNo: "desc" },
        select: { employeeNo: true }
      });
      const nextEmployeeNo = (lastTrainer?.employeeNo || TRAINER_ID_OFFSET) + 1;
      trainer = await prisma2.trainer.update({
        where: { id },
        data: { employeeNo: nextEmployeeNo }
      });
      try {
        const trainerName = `${trainer.firstName || ""} ${trainer.lastName || ""}`.trim();
        await deviceManager.addUser({
          uid: nextEmployeeNo,
          id: nextEmployeeNo,
          userId: nextEmployeeNo,
          employeeNo: nextEmployeeNo,
          name: trainerName,
          fullName: trainerName,
          firstName: trainer.firstName,
          lastName: trainer.lastName,
          privilege: 0,
          password: ""
        });
        await prisma2.trainer.update({
          where: { id: trainer.id },
          data: { deviceSynced: true }
        });
        deviceLogger2.info("Assigned ID and synced trainer to device", { employeeNo: nextEmployeeNo });
      } catch (error) {
        deviceLogger2.error("Failed to create trainer on device", { error: error.message });
      }
    }
    if (trainer.employeeNo) {
      try {
        const trainerName = `${trainer.firstName || ""} ${trainer.lastName || ""}`.trim();
        await deviceManager.updateUser({
          userId: trainer.employeeNo,
          name: trainerName
        });
        deviceLogger2.info("Synced trainer update to device", {
          employeeNo: trainer.employeeNo
        });
      } catch (error) {
        deviceLogger2.error("Failed to update trainer on device", {
          employeeNo: trainer.employeeNo,
          error: error.message
        });
      }
    }
    return trainer;
  });
  ipcMain2.handle("trainers:delete", async (_, id) => {
    const trainer = await prisma2.trainer.findUnique({
      where: { id },
      select: { id: true, employeeNo: true, firstName: true, lastName: true }
    });
    if (!trainer) {
      throw new Error("Trainer not found");
    }
    if (trainer.employeeNo) {
      try {
        await deviceManager.deleteUser(trainer.employeeNo);
        deviceLogger2.info("Deleted trainer from device", {
          employeeNo: trainer.employeeNo,
          name: `${trainer.firstName} ${trainer.lastName || ""}`.trim()
        });
      } catch (error) {
        deviceLogger2.error("Failed to delete trainer from device", {
          employeeNo: trainer.employeeNo,
          error: error.message
        });
      }
    }
    return await prisma2.trainer.delete({
      where: { id }
    });
  });
}

// electron/handlers/plans.ts
function registerPlansHandlers(ipcMain2, prisma2) {
  ipcMain2.handle("plans:getAll", async () => {
    return await prisma2.membershipPlan.findMany({
      orderBy: { price: "asc" }
    });
  });
  ipcMain2.handle("plans:create", async (_, data) => {
    return await prisma2.membershipPlan.create({
      data
    });
  });
  ipcMain2.handle("plans:update", async (_, id, data) => {
    return await prisma2.membershipPlan.update({
      where: { id },
      data
    });
  });
  ipcMain2.handle("plans:delete", async (_, id) => {
    return await prisma2.membershipPlan.delete({
      where: { id }
    });
  });
}

// electron/handlers/attendance.ts
function registerAttendanceHandlers(ipcMain2, prisma2) {
  ipcMain2.handle("attendance:getRecent", async (_, limit = 50) => {
    return await prisma2.attendance.findMany({
      take: limit,
      orderBy: { checkInTime: "desc" },
      include: {
        member: true
      }
    });
  });
  ipcMain2.handle("attendance:getAll", async () => {
    return await prisma2.attendance.findMany({
      orderBy: { checkInTime: "desc" },
      include: {
        member: true
      }
    });
  });
  ipcMain2.handle("attendance:getActiveSession", async (_, memberId) => {
    return null;
  });
  ipcMain2.handle("attendance:manualEntry", async (_, memberId) => {
    const member = await prisma2.member.findUnique({ where: { id: memberId } });
    if (!member) throw new Error("Member not found");
    const validation = validateCheckIn(member);
    if (!validation.allowed) {
      throw new Error(validation.reason || "Check-in not allowed");
    }
    return await prisma2.attendance.create({
      data: {
        memberId,
        checkInTime: /* @__PURE__ */ new Date(),
        method: "MANUAL"
      }
    });
  });
}

// electron/handlers/trainerAttendance.ts
function registerTrainerAttendanceHandlers(ipcMain2, prisma2) {
  ipcMain2.handle("trainerAttendance:getAll", async () => {
    return await prisma2.trainerAttendance.findMany({
      orderBy: { checkInTime: "desc" },
      include: { trainer: true }
    });
  });
  ipcMain2.handle("trainerAttendance:manualEntry", async (_, trainerId) => {
    const trainer = await prisma2.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) throw new Error("Trainer not found");
    return await prisma2.trainerAttendance.create({
      data: { trainerId, checkInTime: /* @__PURE__ */ new Date(), method: "MANUAL" }
    });
  });
}

// electron/handlers/payments.ts
function registerPaymentsHandlers(ipcMain2, prisma2) {
  ipcMain2.handle("payments:getAll", async () => {
    return await prisma2.payment.findMany({
      include: {
        member: true
      },
      orderBy: { paymentDate: "desc" }
    });
  });
  ipcMain2.handle("payments:getByMember", async (_, memberId) => {
    return await prisma2.payment.findMany({
      where: { memberId },
      orderBy: { paymentDate: "desc" }
    });
  });
  ipcMain2.handle("payments:create", async (_, data) => {
    return await prisma2.payment.create({
      data
    });
  });
}

// electron/handlers/system.ts
var import_electron2 = require("electron");
var import_fs2 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));
function registerSystemHandlers(ipcMain2, dbPath2, prisma2) {
  ipcMain2.handle("system:backupDb", async () => {
    const win = import_electron2.BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: "No focused window" };
    const { canceled, filePath } = await import_electron2.dialog.showSaveDialog(win, {
      title: "Backup Database",
      defaultPath: `gms_backup_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.db`,
      filters: [{ name: "SQLite Database", extensions: ["db"] }]
    });
    if (canceled || !filePath) return { success: false, error: "User canceled" };
    try {
      await prisma2.$disconnect();
      import_fs2.default.copyFileSync(dbPath2, filePath);
      await prisma2.$connect();
      return { success: true, filePath };
    } catch (error) {
      console.error("Backup error:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain2.handle("system:getDbPath", () => {
    return dbPath2;
  });
  ipcMain2.handle("system:restoreDb", async () => {
    const win = import_electron2.BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: "No focused window" };
    const { canceled, filePaths } = await import_electron2.dialog.showOpenDialog(win, {
      title: "Restore Database",
      properties: ["openFile"],
      filters: [{ name: "SQLite Database", extensions: ["db"] }]
    });
    if (canceled || filePaths.length === 0) return { success: false, error: "User canceled" };
    try {
      await prisma2.$disconnect();
      if (import_fs2.default.existsSync(`${dbPath2}-wal`)) import_fs2.default.unlinkSync(`${dbPath2}-wal`);
      if (import_fs2.default.existsSync(`${dbPath2}-shm`)) import_fs2.default.unlinkSync(`${dbPath2}-shm`);
      import_fs2.default.copyFileSync(filePaths[0], dbPath2);
      import_electron2.app.relaunch();
      import_electron2.app.quit();
      return { success: true };
    } catch (error) {
      console.error("Restore error:", error);
      await prisma2.$connect().catch(() => {
      });
      return { success: false, error: error.message };
    }
  });
  ipcMain2.handle("system:resetDb", async () => {
    try {
      const isDev2 = !import_electron2.app.isPackaged;
      await prisma2.$disconnect();
      if (isDev2) {
        const sqlite3 = require("sqlite3").verbose();
        const db = new sqlite3.Database(dbPath2);
        await new Promise((resolve, reject) => {
          db.serialize(() => {
            db.run("PRAGMA foreign_keys = OFF");
            const tables = ["Payment", "Attendance", "Member", "Trainer", "MembershipPlan", "Owner"];
            for (const table of tables) {
              db.run(`DELETE FROM "${table}"`);
            }
            db.run("PRAGMA foreign_keys = ON", (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
        db.close();
        await prisma2.$connect();
        return { success: true };
      } else {
        const pristineDb = import_path3.default.join(process.resourcesPath, "dev.db");
        if (!import_fs2.default.existsSync(pristineDb)) {
          return { success: false, error: "Pristine database not found in app resources." };
        }
        if (import_fs2.default.existsSync(`${dbPath2}-wal`)) import_fs2.default.unlinkSync(`${dbPath2}-wal`);
        if (import_fs2.default.existsSync(`${dbPath2}-shm`)) import_fs2.default.unlinkSync(`${dbPath2}-shm`);
        import_fs2.default.copyFileSync(pristineDb, dbPath2);
        import_electron2.app.relaunch();
        import_electron2.app.quit();
        return { success: true };
      }
    } catch (error) {
      console.error("Reset DB error:", error);
      await prisma2.$connect().catch(() => {
      });
      return { success: false, error: error.message };
    }
  });
}

// electron/main.ts
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception in main process:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection in main process:", reason);
});
var isDev = !import_electron3.app.isPackaged;
var dbPath = isDev ? import_path4.default.join(__dirname, "../prisma/dev.db") : import_path4.default.join(import_electron3.app.getPath("userData"), "database.db");
if (!isDev) {
  if (!import_fs3.default.existsSync(dbPath)) {
    try {
      const sourceDb = import_path4.default.join(process.resourcesPath, "dev.db");
      if (import_fs3.default.existsSync(sourceDb)) {
        import_fs3.default.copyFileSync(sourceDb, dbPath);
        console.log("Initial database copied to user data directory.");
      } else {
        console.error("Source dev.db not found in resources:", sourceDb);
      }
    } catch (err) {
      console.error("Failed to copy initial database:", err);
    }
  }
}
var prisma = new import_client.PrismaClient({
  datasources: {
    db: {
      url: `file:${dbPath}`
    }
  }
});
var mainWindow = null;
function getMainWindow() {
  return mainWindow;
}
function createWindow() {
  mainWindow = new import_electron3.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: import_path4.default.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(import_path4.default.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron3.app.whenReady().then(async () => {
  const mediaDir = import_path4.default.join(import_electron3.app.getPath("userData"), "media");
  if (!import_fs3.default.existsSync(mediaDir)) {
    import_fs3.default.mkdirSync(mediaDir, { recursive: true });
  }
  registerAuthHandlers(import_electron3.ipcMain, prisma);
  registerMembersHandlers(import_electron3.ipcMain, prisma, import_electron3.app.getPath("userData"));
  registerTrainersHandlers(import_electron3.ipcMain, prisma);
  registerPlansHandlers(import_electron3.ipcMain, prisma);
  registerAttendanceHandlers(import_electron3.ipcMain, prisma);
  registerTrainerAttendanceHandlers(import_electron3.ipcMain, prisma);
  registerPaymentsHandlers(import_electron3.ipcMain, prisma);
  registerSystemHandlers(import_electron3.ipcMain, dbPath, prisma);
  registerZkTecoDeviceHandlers(import_electron3.ipcMain, prisma, getMainWindow);
  const getMemberByDeviceUserId = async (deviceUserId) => {
    return await prisma.member.findFirst({
      where: { employeeNo: deviceUserId }
    });
  };
  const getTrainerByDeviceUserId = async (deviceUserId) => {
    return await prisma.trainer.findFirst({
      where: { employeeNo: deviceUserId }
    });
  };
  registerDeviceAttendanceBridge({
    prisma,
    getMemberByDeviceUserId,
    getTrainerByDeviceUserId,
    getMainWindow
  });
  createWindow();
  const settings = deviceManager.getSettings();
  if (settings.enabled && settings.ip) {
    deviceManager.startAutoLifecycle();
    setTimeout(async () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        await deviceManager.syncAttendance();
      }
    }, 2e3);
  }
  import_electron3.app.on("activate", () => {
    if (import_electron3.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron3.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron3.app.quit();
  }
});
import_electron3.app.on("before-quit", async () => {
  try {
    deviceManager.disconnect();
  } catch {
  }
  try {
    await prisma.$disconnect();
  } catch {
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  prisma
});
