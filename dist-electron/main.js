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
var import_electron2 = require("electron");
var import_path3 = __toESM(require("path"));
var import_client = require("@prisma/client");
var import_fs2 = __toESM(require("fs"));

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
var import_path = __toESM(require("path"));
function registerMembersHandlers(ipcMain2, prisma2, userDataPath) {
  ipcMain2.handle("members:getAll", async () => {
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
    return await prisma2.member.create({
      data
    });
  });
  ipcMain2.handle("members:update", async (_, id, data) => {
    return await prisma2.member.update({
      where: { id },
      data
    });
  });
  ipcMain2.handle("members:delete", async (_, id) => {
    return await prisma2.member.delete({
      where: { id }
    });
  });
  ipcMain2.handle("members:getPhotoPath", async (_, filename) => {
    return import_path.default.join(userDataPath, "media", filename);
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

// electron/services/zkteco.ts
var ZKLib = require("node-zklib");
async function syncZKTecoLogs(ip, port, prisma2) {
  let zkInstance = new ZKLib(ip, port, 1e4, 4e3);
  try {
    await zkInstance.createSocket();
    const logs = await zkInstance.getAttendances();
    if (!logs || !logs.data || logs.data.length === 0) {
      zkInstance.disconnect();
      return 0;
    }
    let syncedCount = 0;
    for (const log of logs.data) {
      const member = await prisma2.member.findUnique({
        where: { biometricId: log.deviceUserId }
      });
      if (member) {
        if (member.status !== "ACTIVE" || !member.planId) continue;
        const existing = await prisma2.attendance.findFirst({
          where: {
            memberId: member.id,
            checkInTime: new Date(log.recordTime)
          }
        });
        if (!existing) {
          await prisma2.attendance.create({
            data: {
              memberId: member.id,
              checkInTime: new Date(log.recordTime),
              method: "BIOMETRIC"
            }
          });
          syncedCount++;
        }
      }
    }
    zkInstance.disconnect();
    return syncedCount;
  } catch (error) {
    console.error("Error connecting to ZKTeco:", error);
    try {
      zkInstance.disconnect();
    } catch (e) {
    }
    if (process.env.NODE_ENV === "development") {
      console.log("Returning mock sync success for development");
      return 1;
    }
    const errorMessage = error instanceof Error ? error.message : error?.err || error?.message || String(error);
    throw new Error(`Connection failed: ${errorMessage}`);
  }
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
  ipcMain2.handle("attendance:syncDevice", async (_, ip, port) => {
    try {
      const result = await syncZKTecoLogs(ip, port, prisma2);
      return { success: true, count: result };
    } catch (error) {
      console.error("ZKTeco sync error:", error);
      return { success: false, error: error.message };
    }
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
var import_electron = require("electron");
var import_fs = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));
function registerSystemHandlers(ipcMain2, dbPath2, prisma2) {
  ipcMain2.handle("system:backupDb", async () => {
    const win = import_electron.BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: "No focused window" };
    const { canceled, filePath } = await import_electron.dialog.showSaveDialog(win, {
      title: "Backup Database",
      defaultPath: `gms_backup_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.db`,
      filters: [{ name: "SQLite Database", extensions: ["db"] }]
    });
    if (canceled || !filePath) return { success: false, error: "User canceled" };
    try {
      await prisma2.$disconnect();
      import_fs.default.copyFileSync(dbPath2, filePath);
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
    const win = import_electron.BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: "No focused window" };
    const { canceled, filePaths } = await import_electron.dialog.showOpenDialog(win, {
      title: "Restore Database",
      properties: ["openFile"],
      filters: [{ name: "SQLite Database", extensions: ["db"] }]
    });
    if (canceled || filePaths.length === 0) return { success: false, error: "User canceled" };
    try {
      await prisma2.$disconnect();
      if (import_fs.default.existsSync(`${dbPath2}-wal`)) import_fs.default.unlinkSync(`${dbPath2}-wal`);
      if (import_fs.default.existsSync(`${dbPath2}-shm`)) import_fs.default.unlinkSync(`${dbPath2}-shm`);
      import_fs.default.copyFileSync(filePaths[0], dbPath2);
      import_electron.app.relaunch();
      import_electron.app.exit(0);
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
      const isDev2 = !import_electron.app.isPackaged;
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
        const pristineDb = import_path2.default.join(process.resourcesPath, "dev.db");
        if (!import_fs.default.existsSync(pristineDb)) {
          return { success: false, error: "Pristine database not found in app resources." };
        }
        if (import_fs.default.existsSync(`${dbPath2}-wal`)) import_fs.default.unlinkSync(`${dbPath2}-wal`);
        if (import_fs.default.existsSync(`${dbPath2}-shm`)) import_fs.default.unlinkSync(`${dbPath2}-shm`);
        import_fs.default.copyFileSync(pristineDb, dbPath2);
        import_electron.app.relaunch();
        import_electron.app.exit(0);
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
var isDev = !import_electron2.app.isPackaged;
var dbPath = isDev ? import_path3.default.join(__dirname, "../prisma/dev.db") : import_path3.default.join(import_electron2.app.getPath("userData"), "database.db");
if (!isDev) {
  if (!import_fs2.default.existsSync(dbPath)) {
    try {
      const sourceDb = import_path3.default.join(process.resourcesPath, "dev.db");
      if (import_fs2.default.existsSync(sourceDb)) {
        import_fs2.default.copyFileSync(sourceDb, dbPath);
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
function createWindow() {
  mainWindow = new import_electron2.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: import_path3.default.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(import_path3.default.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron2.app.whenReady().then(async () => {
  const mediaDir = import_path3.default.join(import_electron2.app.getPath("userData"), "media");
  if (!import_fs2.default.existsSync(mediaDir)) {
    import_fs2.default.mkdirSync(mediaDir, { recursive: true });
  }
  registerAuthHandlers(import_electron2.ipcMain, prisma);
  registerMembersHandlers(import_electron2.ipcMain, prisma, import_electron2.app.getPath("userData"));
  registerTrainersHandlers(import_electron2.ipcMain, prisma);
  registerPlansHandlers(import_electron2.ipcMain, prisma);
  registerAttendanceHandlers(import_electron2.ipcMain, prisma);
  registerPaymentsHandlers(import_electron2.ipcMain, prisma);
  registerSystemHandlers(import_electron2.ipcMain, dbPath, prisma);
  createWindow();
  import_electron2.app.on("activate", () => {
    if (import_electron2.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron2.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    import_electron2.app.quit();
  }
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  prisma
});
