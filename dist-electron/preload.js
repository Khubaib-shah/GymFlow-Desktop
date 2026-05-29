"use strict";

// electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("api", {
  auth: {
    login: (credentials) => import_electron.ipcRenderer.invoke("auth:login", credentials),
    createInitialOwner: (data) => import_electron.ipcRenderer.invoke("auth:createInitialOwner", data),
    checkHasOwner: () => import_electron.ipcRenderer.invoke("auth:checkHasOwner")
  },
  members: {
    getAll: () => import_electron.ipcRenderer.invoke("members:getAll"),
    getById: (id) => import_electron.ipcRenderer.invoke("members:getById", id),
    create: (data) => import_electron.ipcRenderer.invoke("members:create", data),
    update: (id, data) => import_electron.ipcRenderer.invoke("members:update", id, data),
    delete: (id) => import_electron.ipcRenderer.invoke("members:delete", id),
    getPhotoPath: (filename) => import_electron.ipcRenderer.invoke("members:getPhotoPath", filename)
  },
  trainers: {
    getAll: () => import_electron.ipcRenderer.invoke("trainers:getAll"),
    create: (data) => import_electron.ipcRenderer.invoke("trainers:create", data),
    update: (id, data) => import_electron.ipcRenderer.invoke("trainers:update", id, data),
    delete: (id) => import_electron.ipcRenderer.invoke("trainers:delete", id)
  },
  plans: {
    getAll: () => import_electron.ipcRenderer.invoke("plans:getAll"),
    create: (data) => import_electron.ipcRenderer.invoke("plans:create", data),
    update: (id, data) => import_electron.ipcRenderer.invoke("plans:update", id, data),
    delete: (id) => import_electron.ipcRenderer.invoke("plans:delete", id)
  },
  attendance: {
    getRecent: (limit) => import_electron.ipcRenderer.invoke("attendance:getRecent", limit),
    getAll: () => import_electron.ipcRenderer.invoke("attendance:getAll"),
    syncDevice: (ip, port) => import_electron.ipcRenderer.invoke("attendance:syncDevice", ip, port),
    manualEntry: (memberId) => import_electron.ipcRenderer.invoke("attendance:manualEntry", memberId),
    getActiveSession: (memberId) => import_electron.ipcRenderer.invoke("attendance:getActiveSession", memberId)
  },
  payments: {
    getAll: () => import_electron.ipcRenderer.invoke("payments:getAll"),
    getByMember: (memberId) => import_electron.ipcRenderer.invoke("payments:getByMember", memberId),
    create: (data) => import_electron.ipcRenderer.invoke("payments:create", data)
  },
  system: {
    getDbPath: () => import_electron.ipcRenderer.invoke("system:getDbPath"),
    backupDb: () => import_electron.ipcRenderer.invoke("system:backupDb"),
    restoreDb: () => import_electron.ipcRenderer.invoke("system:restoreDb"),
    resetDb: () => import_electron.ipcRenderer.invoke("system:resetDb")
  }
});
