import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  auth: {
    login: (credentials: any) => ipcRenderer.invoke("auth:login", credentials),
    createInitialOwner: (data: any) =>
      ipcRenderer.invoke("auth:createInitialOwner", data),
    checkHasOwner: () => ipcRenderer.invoke("auth:checkHasOwner"),
  },
  members: {
    getAll: () => ipcRenderer.invoke("members:getAll"),
    getById: (id: string) => ipcRenderer.invoke("members:getById", id),
    create: (data: any) =>
      ipcRenderer.invoke("members:create", data),
    update: (id: string, data: any) =>
      ipcRenderer.invoke("members:update", id, data),
    delete: (id: string) => ipcRenderer.invoke("members:delete", id),
    getPhotoPath: (filename: string) =>
      ipcRenderer.invoke("members:getPhotoPath", filename),
    getDeviceSyncStatus: () =>
      ipcRenderer.invoke("members:getDeviceSyncStatus"),
  },
  trainers: {
    getAll: () => ipcRenderer.invoke("trainers:getAll"),
    create: (data: any) => ipcRenderer.invoke("trainers:create", data),
    update: (id: string, data: any) =>
      ipcRenderer.invoke("trainers:update", id, data),
    delete: (id: string) => ipcRenderer.invoke("trainers:delete", id),
  },
  plans: {
    getAll: () => ipcRenderer.invoke("plans:getAll"),
    create: (data: any) => ipcRenderer.invoke("plans:create", data),
    update: (id: string, data: any) =>
      ipcRenderer.invoke("plans:update", id, data),
    delete: (id: string) => ipcRenderer.invoke("plans:delete", id),
  },
  attendance: {
    getRecent: (limit?: number) =>
      ipcRenderer.invoke("attendance:getRecent", limit),
    getAll: () => ipcRenderer.invoke("attendance:getAll"),

    manualEntry: (memberId: string) =>
      ipcRenderer.invoke("attendance:manualEntry", memberId),
    getActiveSession: (memberId: string) =>
      ipcRenderer.invoke("attendance:getActiveSession", memberId),
  },
  payments: {
    getAll: () => ipcRenderer.invoke("payments:getAll"),
    getByMember: (memberId: string) =>
      ipcRenderer.invoke("payments:getByMember", memberId),
    create: (data: any) => ipcRenderer.invoke("payments:create", data),
  },
  trainerAttendance: {
    getAll: () => ipcRenderer.invoke("trainerAttendance:getAll"),
    manualEntry: (trainerId: string) =>
      ipcRenderer.invoke("trainerAttendance:manualEntry", trainerId),
    getActiveSession: (trainerId: string) =>
      ipcRenderer.invoke("trainerAttendance:getActiveSession", trainerId),
  },
  system: {
    getDbPath: () => ipcRenderer.invoke("system:getDbPath"),
    backupDb: () => ipcRenderer.invoke("system:backupDb"),
    restoreDb: () => ipcRenderer.invoke("system:restoreDb"),
    resetDb: () => ipcRenderer.invoke("system:resetDb"),
  },
  device: {
    getSettings: () => ipcRenderer.invoke("device:get-settings"),
    saveSettings: (settings: any) =>
      ipcRenderer.invoke("device:save-settings", settings),
    getStatus: () => ipcRenderer.invoke("device:get-status"),
    testConnection: () => ipcRenderer.invoke("device:test-connection"),
    getUsers: () => ipcRenderer.invoke("device:get-users"),
    getAttendance: () => ipcRenderer.invoke("device:get-attendance"),
    addUser: (payload: any) => ipcRenderer.invoke("device:add-user", payload),
    updateUser: (payload: any) =>
      ipcRenderer.invoke("device:update-user", payload),
    deleteUser: (userId: number) =>
      ipcRenderer.invoke("device:delete-user", userId),
    clearAttendance: () => ipcRenderer.invoke("device:clear-attendance"),
    restart: () => ipcRenderer.invoke("device:restart"),
    connect: () => ipcRenderer.invoke("device:connect"),
    disconnect: () => ipcRenderer.invoke("device:disconnect"),
    reconnect: () => ipcRenderer.invoke("device:reconnect"),
    listen: () => ipcRenderer.invoke("device:listen"),
    stopListen: () => ipcRenderer.invoke("device:stopListen"),
    configure: (config: any) => ipcRenderer.invoke("device:configure", config),
    getConfig: () => ipcRenderer.invoke("device:get-config"),

    /**
     * Sync all existing attendance records from the device.
     * This is useful when the app was closed while the device was on,
     * and we need to fetch attendance that was recorded during that time.
     */
    syncAttendance: () => ipcRenderer.invoke("device:sync-attendance"),

    /**
     * Subscribe to attendance events from the device.
     * Returns a cleanup function that MUST be called on component unmount
     * to prevent listener leaks.
     */
    onAttendanceEvent: (callback: (type: string, data: any) => void) => {
      const checkinListener = (_: any, data: any) => callback("checkin", data);
      const checkoutListener = (_: any, data: any) =>
        callback("checkout", data);
      const expiredListener = (_: any, data: any) => callback("expired", data);
      const inactiveListener = (_: any, data: any) =>
        callback("inactive", data);
      const unknownListener = (_: any, data: any) => callback("unknown", data);
      const trainerCheckinListener = (_: any, data: any) => callback("trainerCheckin", data);
      const trainerCheckoutListener = (_: any, data: any) => callback("trainerCheckout", data);

      ipcRenderer.on("attendance:checkin", checkinListener);
      ipcRenderer.on("attendance:checkout", checkoutListener);
      ipcRenderer.on("attendance:expired", expiredListener);
      ipcRenderer.on("attendance:inactive", inactiveListener);
      ipcRenderer.on("attendance:unknown", unknownListener);
      ipcRenderer.on("trainerAttendance:checkin", trainerCheckinListener);
      ipcRenderer.on("trainerAttendance:checkout", trainerCheckoutListener);

      // Return cleanup function
      return () => {
        ipcRenderer.removeListener("attendance:checkin", checkinListener);
        ipcRenderer.removeListener("attendance:checkout", checkoutListener);
        ipcRenderer.removeListener("attendance:expired", expiredListener);
        ipcRenderer.removeListener("attendance:inactive", inactiveListener);
        ipcRenderer.removeListener("attendance:unknown", unknownListener);
        ipcRenderer.removeListener("trainerAttendance:checkin", trainerCheckinListener);
        ipcRenderer.removeListener("trainerAttendance:checkout", trainerCheckoutListener);
      };
    },
    onStatusChange: (callback: (status: any) => void) => {
      const listener = (_: any, status: any) => callback(status);
      ipcRenderer.on("device:status", listener);
      return () => {
        ipcRenderer.removeListener("device:status", listener);
      };
    },
    syncUsers: () => ipcRenderer.invoke("device:sync-users"),

    /**
     * Subscribe to auto-created events from device sync.
     * Fires when a fingerprint scan triggers automatic member/trainer creation.
     * Returns a cleanup function.
     */
    onAutoCreated: (callback: (type: "member" | "trainer", data: any) => void) => {
      const memberListener = (_: any, data: any) => callback("member", data);
      const trainerListener = (_: any, data: any) => callback("trainer", data);

      ipcRenderer.on("member:auto-created", memberListener);
      ipcRenderer.on("trainer:auto-created", trainerListener);

      return () => {
        ipcRenderer.removeListener("member:auto-created", memberListener);
        ipcRenderer.removeListener("trainer:auto-created", trainerListener);
      };
    },
  },
});