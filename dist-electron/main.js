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
  packet.write(user.userId.substring(0, 8), 48, "ascii");
  return packet;
}

// electron/zkTeco/helpers/createDeleteUserPacket.ts
function createDeleteUserPacket(uid) {
  const packet = Buffer.alloc(2);
  packet.writeUInt16LE(uid, 0);
  return packet;
}

// electron/zkTeco/helpers/decodeUserData72.ts
function decodeUserData72(userData) {
  return {
    uid: userData.readUInt16LE(0),
    role: userData.readUInt8(2),
    password: userData.subarray(3, 11).toString("ascii").replace(/\0/g, ""),
    name: userData.subarray(11, 35).toString("ascii").replace(/\0/g, ""),
    cardNo: userData.readUInt32LE(35),
    group: userData.readUInt8(39),
    userTzFlag: userData.readUInt16LE(40),
    tz1: userData.readUInt16LE(42),
    tz2: userData.readUInt16LE(44),
    tz3: userData.readUInt16LE(46),
    userId: userData.subarray(48, 57).toString("ascii").replace(/\0/g, "")
  };
}

// electron/zkTeco/ZKClient.ts
var { COMMANDS } = require("node-zklib/constants");
var ZKLib = require("node-zklib");
var ZKClient = class {
  client = null;
  settings = null;
  async disableDevice() {
    await this.executeCommand(COMMANDS.CMD_DISABLEDEVICE);
  }
  async enableDevice() {
    await this.executeCommand(COMMANDS.CMD_ENABLEDEVICE);
  }
  async refreshData() {
    await this.executeCommand(COMMANDS.CMD_REFRESHDATA);
  }
  async connect(settings) {
    this.settings = settings;
    if (!settings.enabled || !settings.ip) {
      throw new ConnectionError("Device is disabled or IP is not configured");
    }
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {
      }
      this.client = null;
    }
    try {
      this.client = new ZKLib(
        settings.ip,
        settings.port,
        settings.timeout,
        settings.pollInterval
      );
      await this.client.createSocket();
    } catch (error) {
      this.client = null;
      throw new ConnectionError(
        `Unable to connect to ZKTeco device: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async disconnect() {
    if (!this.client) return;
    try {
      await this.client.disconnect();
    } catch {
    } finally {
      this.client = null;
    }
  }
  isConnected() {
    return Boolean(this.client);
  }
  async executeCommand(command, data) {
    if (!this.client) {
      throw new ConnectionError("Device is not connected");
    }
    return this.client.executeCmd(command, data);
  }
  async getDeviceInfo() {
    if (!this.client) throw new ConnectionError("Device is not connected");
    try {
      const info = await this.client.getInfo();
      return info;
    } catch (error) {
      throw new DeviceError(
        `Failed to read device info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async setUser(user) {
    if (!this.client) throw new ConnectionError("Device is not connected");
    const packet = createUserPacket(user);
    await this.disableDevice();
    const result = await this.executeCommand(COMMANDS.CMD_USER_WRQ, packet);
    await this.refreshData();
    await this.enableDevice();
    return result;
  }
  async getUsers() {
    if (!this.client) {
      throw new ConnectionError("Device is not connected");
    }
    try {
      await this.client.executeCmd(COMMANDS.CMD_DISABLEDEVICE);
      const payload = Buffer.from([
        1,
        9,
        0,
        5,
        0,
        0,
        0,
        0,
        0,
        0,
        0
      ]);
      const response = await this.client.executeCmd(
        COMMANDS.CMD_DATA_WRRQ,
        payload
      );
      console.log("RAW RESPONSE:", response);
      console.log("HEX:", response.toString("hex"));
      console.log("LENGTH:", response.length);
      const users = [];
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
        `Failed to read users: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async deleteUser(uid) {
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
    const mask = COMMANDS.EF_ATTLOG | COMMANDS.EF_VERIFY | COMMANDS.EF_FINGER | COMMANDS.EF_ENROLLUSER | COMMANDS.EF_ENROLLFINGER | COMMANDS.EF_BUTTON | COMMANDS.EF_UNLOCK | COMMANDS.EF_FPFTR | COMMANDS.EF_ALARM;
    payload.writeUInt32LE(mask, 0);
    console.log(mask);
    const res = await this.executeCommand(COMMANDS.CMD_REG_EVENT, payload);
    console.log("REGISTER EVENT RESPONSE:", res?.toString("hex"));
    return res;
  }
  async getAttendance() {
    if (!this.client) throw new ConnectionError("Device is not connected");
    try {
      const response = await this.client.getAttendances();
      return Array.isArray(response?.data) ? response.data : [];
    } catch (error) {
      throw new DeviceError(
        `Failed to read attendance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async clearAttendance() {
    if (!this.client) throw new ConnectionError("Device is not connected");
    try {
      await this.client.clearAttendanceLog();
    } catch (error) {
      throw new DeviceError(
        `Failed to clear attendance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async restart() {
    if (!this.client) throw new ConnectionError("Device is not connected");
    try {
      await this.client.executeCmd(COMMANDS.CMD_RESTART);
    } catch (error) {
      throw new DeviceError(
        `Failed to restart device: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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

// electron/zkTeco/DeviceManager.ts
var DeviceManager = class extends import_events.EventEmitter {
  client = new ZKClient();
  settings = deviceSettingsStore.load();
  connected = false;
  reconnectTimer = null;
  pollTimer = null;
  lastConnectedAt = null;
  lastAttendanceFingerprint = /* @__PURE__ */ new Set();
  constructor() {
    super();
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
      this.lastConnectedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.emit("status", this.buildStatus("connected", "Connected successfully"));
      return this.buildStatus("connected", "Connected successfully");
    } catch (error) {
      this.connected = false;
      this.emit("status", this.buildStatus("offline", toErrorMessage(error)));
      throw error;
    }
  }
  async disconnect() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reconnectTimer) clearInterval(this.reconnectTimer);
    this.pollTimer = null;
    this.reconnectTimer = null;
    await this.client.disconnect();
    this.connected = false;
    this.emit("status", this.buildStatus("disconnected", "Device disconnected"));
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
      const infoAny = info;
      const firmwareVersion = infoAny?.firmwareVersion || infoAny?.firmware || infoAny?.firmwareVer || infoAny?.ver || infoAny?.version || infoAny?.firmware_ver || infoAny?.firmVer || infoAny?.firmver || "Unknown";
      return {
        ...status,
        firmwareVersion,
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
    this.startPolling();
    this.scheduleReconnect();
  }
  startPolling() {
    if (this.pollTimer) return;
    const interval = this.settings.pollInterval || DEFAULT_POLL_INTERVAL_MS;
    this.pollTimer = setInterval(async () => {
      if (!this.connected) {
        try {
          await this.connect();
        } catch {
        }
        return;
      }
      try {
        const logs = await this.getAttendance();
        const newLogs = logs.filter((log) => {
          const key = `${log.userId ?? log.uid ?? log.deviceUserId ?? "unknown"}-${log.timestamp ?? log.attTime ?? ""}`;
          return !this.lastAttendanceFingerprint.has(key);
        });
        this.lastAttendanceFingerprint = /* @__PURE__ */ new Set([...Array.from(this.lastAttendanceFingerprint).slice(-200), ...newLogs.map((item) => `${item.userId ?? item.uid ?? item.deviceUserId ?? "unknown"}-${item.timestamp ?? item.attTime ?? ""}`)]);
        if (newLogs.length > 0) {
          this.emit("attendance", newLogs);
        }
      } catch (error) {
        this.emit("status", this.buildStatus("offline", toErrorMessage(error)));
        this.connected = false;
      }
    }, interval);
  }
  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setInterval(async () => {
      if (!this.connected) {
        try {
          await this.connect();
        } catch {
        }
      }
    }, DEFAULT_RECONNECT_INTERVAL_MS);
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

// electron/zkTeco/AttendanceSync.ts
var import_events2 = require("events");
var AttendanceSyncService = class extends import_events2.EventEmitter {
  lastSyncAt = null;
  seen = /* @__PURE__ */ new Set();
  markSynced(attendance) {
    const unique = attendance.filter((item) => {
      const key = `${item.userId ?? item.uid ?? item.deviceUserId ?? "unknown"}-${item.timestamp ?? item.attTime ?? ""}`;
      if (this.seen.has(key)) return false;
      this.seen.add(key);
      return true;
    });
    this.lastSyncAt = /* @__PURE__ */ new Date();
    return unique;
  }
  getLastSyncAt() {
    return this.lastSyncAt;
  }
};
var attendanceSyncService = new AttendanceSyncService();

// electron/zkTeco/ipc/device.ipc.ts
function registerZkTecoDeviceHandlers(ipcMain2, prisma2, getMainWindow2) {
  ipcMain2.handle("device:get-settings", async () => {
    return { success: true, data: deviceManager.getSettings() };
  });
  ipcMain2.handle("device:save-settings", async (_event, settings) => {
    try {
      const saved = await deviceManager.applySettings(settings);
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
    return { success: true, data: { connected: deviceManager.isConnected(), status: deviceManager.isConnected() ? "connected" : "offline", message: deviceManager.isConnected() ? "Connected" : "Disconnected" } };
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
            await deviceManager.updateUser({ userId: m.employeeNo, name, enabled: false });
            deviceLogger2.info("Auto-disabled expired member on device", {
              employeeNo: m.employeeNo,
              name
            });
          } catch (err) {
            deviceLogger2.error("Failed to auto-disable expired member on device", {
              employeeNo: m.employeeNo,
              error: err.message
            });
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
    const lastMember = await prisma2.member.findFirst({
      where: { employeeNo: { not: null } },
      orderBy: { employeeNo: "desc" },
      select: { employeeNo: true }
    });
    const nextEmployeeNo = (lastMember?.employeeNo || 0) + 1;
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
        throw new Error("A member with the provided unique field already exists (CNIC or other)");
      }
      throw err;
    }
    let deviceSynced = false;
    let deviceError;
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
          deviceLogger2.info("Waiting for fingerprint enrollment on device", { employeeNo: nextEmployeeNo });
          const enrolled = await deviceManager.waitForEnrollment(nextEmployeeNo, 12e4, 2e3);
          if (enrolled) {
            deviceLogger2.info("Fingerprint enrolled for user on device", { employeeNo: nextEmployeeNo });
            try {
              await prisma2.member.update({ where: { id: member.id }, data: { deviceSynced: true } });
            } catch {
            }
          } else {
            deviceLogger2.warn("Fingerprint enrollment timed out", { employeeNo: nextEmployeeNo });
          }
        } catch (err) {
          deviceLogger2.error("Error while waiting for enrollment", { employeeNo: nextEmployeeNo, error: err?.message });
        }
      })();
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
            deviceLogger2.info("Waiting for manual fingerprint enrollment on device", { employeeNo: nextEmployeeNo });
            const enrolled = await deviceManager.waitForEnrollment(nextEmployeeNo, 12e4, 2e3);
            if (enrolled) {
              deviceLogger2.info("Manual fingerprint enrolled for user on device", { employeeNo: nextEmployeeNo });
              try {
                await prisma2.member.update({ where: { id: member.id }, data: { deviceSynced: true } });
              } catch {
              }
            } else {
              deviceLogger2.warn("Manual fingerprint enrollment timed out", { employeeNo: nextEmployeeNo });
            }
          } catch (err) {
            deviceLogger2.error("Error while waiting for manual enrollment", { employeeNo: nextEmployeeNo, error: err?.message });
          }
        })();
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
    const member = await prisma2.member.update({
      where: { id },
      data
    });
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
}

// electron/handlers/trainers.ts
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
    return await prisma2.trainer.create({
      data
    });
  });
  ipcMain2.handle("trainers:update", async (_, id, data) => {
    return await prisma2.trainer.update({
      where: { id },
      data
    });
  });
  ipcMain2.handle("trainers:delete", async (_, id) => {
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
    const sixHoursAgo = /* @__PURE__ */ new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
    const staleSessions = await prisma2.attendance.findMany({
      where: { memberId, checkOutTime: null, checkInTime: { lt: sixHoursAgo } }
    });
    for (const session of staleSessions) {
      const autoCheckOutTime = new Date(session.checkInTime);
      autoCheckOutTime.setHours(autoCheckOutTime.getHours() + 6);
      await prisma2.attendance.update({
        where: { id: session.id },
        data: { checkOutTime: autoCheckOutTime }
      });
    }
    return await prisma2.attendance.findFirst({
      where: { memberId, checkOutTime: null, checkInTime: { gte: sixHoursAgo } },
      orderBy: { checkInTime: "desc" }
    });
  });
  ipcMain2.handle("attendance:manualEntry", async (_, memberId) => {
    const sixHoursAgo = /* @__PURE__ */ new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
    const member = await prisma2.member.findUnique({ where: { id: memberId } });
    if (!member) throw new Error("Member not found");
    if (member.status !== "ACTIVE") {
      throw new Error(`This member cannot check in because their status is ${member.status.toLowerCase()}.`);
    }
    if (!member.planId) {
      throw new Error("This member cannot check in because they don't have an active plan.");
    }
    const activeSession = await prisma2.attendance.findFirst({
      where: { memberId, checkOutTime: null, checkInTime: { gte: sixHoursAgo } },
      orderBy: { checkInTime: "desc" }
    });
    if (activeSession) {
      return await prisma2.attendance.update({
        where: { id: activeSession.id },
        data: { checkOutTime: /* @__PURE__ */ new Date() }
      });
    } else {
      return await prisma2.attendance.create({
        data: {
          memberId,
          checkInTime: /* @__PURE__ */ new Date(),
          method: "MANUAL"
        }
      });
    }
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
  ipcMain2.handle("trainerAttendance:getActiveSession", async (_, trainerId) => {
    const twelveHoursAgo = /* @__PURE__ */ new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
    const stale = await prisma2.trainerAttendance.findMany({
      where: { trainerId, checkOutTime: null, checkInTime: { lt: twelveHoursAgo } }
    });
    for (const s of stale) {
      const autoOut = new Date(s.checkInTime);
      autoOut.setHours(autoOut.getHours() + 12);
      await prisma2.trainerAttendance.update({
        where: { id: s.id },
        data: { checkOutTime: autoOut }
      });
    }
    return await prisma2.trainerAttendance.findFirst({
      where: { trainerId, checkOutTime: null, checkInTime: { gte: twelveHoursAgo } },
      orderBy: { checkInTime: "desc" }
    });
  });
  ipcMain2.handle("trainerAttendance:manualEntry", async (_, trainerId) => {
    const twelveHoursAgo = /* @__PURE__ */ new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);
    const trainer = await prisma2.trainer.findUnique({ where: { id: trainerId } });
    if (!trainer) throw new Error("Trainer not found");
    const activeSession = await prisma2.trainerAttendance.findFirst({
      where: { trainerId, checkOutTime: null, checkInTime: { gte: twelveHoursAgo } },
      orderBy: { checkInTime: "desc" }
    });
    if (activeSession) {
      return await prisma2.trainerAttendance.update({
        where: { id: activeSession.id },
        data: { checkOutTime: /* @__PURE__ */ new Date() }
      });
    } else {
      return await prisma2.trainerAttendance.create({
        data: { trainerId, checkInTime: /* @__PURE__ */ new Date(), method: "MANUAL" }
      });
    }
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
      import_electron2.app.exit(0);
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
        import_electron2.app.exit(0);
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
  createWindow();
  const settings = deviceManager.getSettings();
  if (settings.enabled && settings.ip) {
    deviceManager.startAutoLifecycle();
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  prisma
});
