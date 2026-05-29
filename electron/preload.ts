import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: (credentials: any) => ipcRenderer.invoke('auth:login', credentials),
    createInitialOwner: (data: any) => ipcRenderer.invoke('auth:createInitialOwner', data),
    checkHasOwner: () => ipcRenderer.invoke('auth:checkHasOwner'),
  },
  members: {
    getAll: () => ipcRenderer.invoke('members:getAll'),
    getById: (id: string) => ipcRenderer.invoke('members:getById', id),
    create: (data: any) => ipcRenderer.invoke('members:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('members:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('members:delete', id),
    getPhotoPath: (filename: string) => ipcRenderer.invoke('members:getPhotoPath', filename),
  },
  trainers: {
    getAll: () => ipcRenderer.invoke('trainers:getAll'),
    create: (data: any) => ipcRenderer.invoke('trainers:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('trainers:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('trainers:delete', id),
  },
  plans: {
    getAll: () => ipcRenderer.invoke('plans:getAll'),
    create: (data: any) => ipcRenderer.invoke('plans:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('plans:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('plans:delete', id),
  },
  attendance: {
    getRecent: (limit?: number) => ipcRenderer.invoke('attendance:getRecent', limit),
    getAll: () => ipcRenderer.invoke('attendance:getAll'),
    syncDevice: (ip: string, port: number) => ipcRenderer.invoke('attendance:syncDevice', ip, port),
    manualEntry: (memberId: string) => ipcRenderer.invoke('attendance:manualEntry', memberId),
    getActiveSession: (memberId: string) => ipcRenderer.invoke('attendance:getActiveSession', memberId),
  },
  payments: {
    getAll: () => ipcRenderer.invoke('payments:getAll'),
    getByMember: (memberId: string) => ipcRenderer.invoke('payments:getByMember', memberId),
    create: (data: any) => ipcRenderer.invoke('payments:create', data)
  },
  system: {
    getDbPath: () => ipcRenderer.invoke('system:getDbPath'),
    backupDb: () => ipcRenderer.invoke('system:backupDb'),
    restoreDb: () => ipcRenderer.invoke('system:restoreDb'),
    resetDb: () => ipcRenderer.invoke('system:resetDb'),
  }
});
