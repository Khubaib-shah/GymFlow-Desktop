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
    getPhotoPath: (filename) => import_electron.ipcRenderer.invoke("members:getPhotoPath", filename),
    getDeviceSyncStatus: () => import_electron.ipcRenderer.invoke("members:getDeviceSyncStatus")
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
    manualEntry: (memberId) => import_electron.ipcRenderer.invoke("attendance:manualEntry", memberId),
    getActiveSession: (memberId) => import_electron.ipcRenderer.invoke("attendance:getActiveSession", memberId)
  },
  payments: {
    getAll: () => import_electron.ipcRenderer.invoke("payments:getAll"),
    getByMember: (memberId) => import_electron.ipcRenderer.invoke("payments:getByMember", memberId),
    create: (data) => import_electron.ipcRenderer.invoke("payments:create", data)
  },
  trainerAttendance: {
    getAll: () => import_electron.ipcRenderer.invoke("trainerAttendance:getAll"),
    manualEntry: (trainerId) => import_electron.ipcRenderer.invoke("trainerAttendance:manualEntry", trainerId),
    getActiveSession: (trainerId) => import_electron.ipcRenderer.invoke("trainerAttendance:getActiveSession", trainerId)
  },
  system: {
    getDbPath: () => import_electron.ipcRenderer.invoke("system:getDbPath"),
    backupDb: () => import_electron.ipcRenderer.invoke("system:backupDb"),
    restoreDb: () => import_electron.ipcRenderer.invoke("system:restoreDb"),
    resetDb: () => import_electron.ipcRenderer.invoke("system:resetDb")
  },
  device: {
    getSettings: () => import_electron.ipcRenderer.invoke("device:get-settings"),
    saveSettings: (settings) => import_electron.ipcRenderer.invoke("device:save-settings", settings),
    getStatus: () => import_electron.ipcRenderer.invoke("device:get-status"),
    testConnection: () => import_electron.ipcRenderer.invoke("device:test-connection"),
    getUsers: () => import_electron.ipcRenderer.invoke("device:get-users"),
    getAttendance: () => import_electron.ipcRenderer.invoke("device:get-attendance"),
    addUser: (payload) => import_electron.ipcRenderer.invoke("device:add-user", payload),
    updateUser: (payload) => import_electron.ipcRenderer.invoke("device:update-user", payload),
    deleteUser: (userId) => import_electron.ipcRenderer.invoke("device:delete-user", userId),
    clearAttendance: () => import_electron.ipcRenderer.invoke("device:clear-attendance"),
    restart: () => import_electron.ipcRenderer.invoke("device:restart"),
    connect: () => import_electron.ipcRenderer.invoke("device:connect"),
    disconnect: () => import_electron.ipcRenderer.invoke("device:disconnect"),
    reconnect: () => import_electron.ipcRenderer.invoke("device:reconnect"),
    listen: () => import_electron.ipcRenderer.invoke("device:listen"),
    stopListen: () => import_electron.ipcRenderer.invoke("device:stopListen"),
    configure: (config) => import_electron.ipcRenderer.invoke("device:configure", config),
    getConfig: () => import_electron.ipcRenderer.invoke("device:get-config"),
    /**
     * Sync all existing attendance records from the device.
     * This is useful when the app was closed while the device was on,
     * and we need to fetch attendance that was recorded during that time.
     */
    syncAttendance: () => import_electron.ipcRenderer.invoke("device:sync-attendance"),
    /**
     * Subscribe to attendance events from the device.
     * Returns a cleanup function that MUST be called on component unmount
     * to prevent listener leaks.
     */
    onAttendanceEvent: (callback) => {
      const checkinListener = (_, data) => callback("checkin", data);
      const checkoutListener = (_, data) => callback("checkout", data);
      const expiredListener = (_, data) => callback("expired", data);
      const inactiveListener = (_, data) => callback("inactive", data);
      const unknownListener = (_, data) => callback("unknown", data);
      const trainerCheckinListener = (_, data) => callback("trainerCheckin", data);
      const trainerCheckoutListener = (_, data) => callback("trainerCheckout", data);
      import_electron.ipcRenderer.on("attendance:checkin", checkinListener);
      import_electron.ipcRenderer.on("attendance:checkout", checkoutListener);
      import_electron.ipcRenderer.on("attendance:expired", expiredListener);
      import_electron.ipcRenderer.on("attendance:inactive", inactiveListener);
      import_electron.ipcRenderer.on("attendance:unknown", unknownListener);
      import_electron.ipcRenderer.on("trainerAttendance:checkin", trainerCheckinListener);
      import_electron.ipcRenderer.on("trainerAttendance:checkout", trainerCheckoutListener);
      return () => {
        import_electron.ipcRenderer.removeListener("attendance:checkin", checkinListener);
        import_electron.ipcRenderer.removeListener("attendance:checkout", checkoutListener);
        import_electron.ipcRenderer.removeListener("attendance:expired", expiredListener);
        import_electron.ipcRenderer.removeListener("attendance:inactive", inactiveListener);
        import_electron.ipcRenderer.removeListener("attendance:unknown", unknownListener);
        import_electron.ipcRenderer.removeListener("trainerAttendance:checkin", trainerCheckinListener);
        import_electron.ipcRenderer.removeListener("trainerAttendance:checkout", trainerCheckoutListener);
      };
    },
    onStatusChange: (callback) => {
      const listener = (_, status) => callback(status);
      import_electron.ipcRenderer.on("device:status", listener);
      return () => {
        import_electron.ipcRenderer.removeListener("device:status", listener);
      };
    },
    syncUsers: () => import_electron.ipcRenderer.invoke("device:sync-users"),
    /**
     * Subscribe to auto-created events from device sync.
     * Fires when a fingerprint scan triggers automatic member/trainer creation.
     * Returns a cleanup function.
     */
    onAutoCreated: (callback) => {
      const memberListener = (_, data) => callback("member", data);
      const trainerListener = (_, data) => callback("trainer", data);
      import_electron.ipcRenderer.on("member:auto-created", memberListener);
      import_electron.ipcRenderer.on("trainer:auto-created", trainerListener);
      return () => {
        import_electron.ipcRenderer.removeListener("member:auto-created", memberListener);
        import_electron.ipcRenderer.removeListener("trainer:auto-created", trainerListener);
      };
    }
  }
});
