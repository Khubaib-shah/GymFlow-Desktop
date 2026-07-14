export interface ZkTecoDeviceSettings {
  enabled: boolean;
  deviceType: string;
  ip: string;
  port: number;
  timeout: number;
  pollInterval: number;
}

export interface DeviceStatusPayload {
  connected: boolean;
  status: "connected" | "disconnected" | "connecting" | "offline";
  message: string;
  firmwareVersion?: string;
  serialNumber?: string;
  userCount?: number;
  attendanceCount?: number;
  lastConnectedAt?: string | null;
  deviceName?: string;
}

export interface DeviceInfoPayload {
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  userCount?: number;
  attendanceCount?: number;
  deviceName?: string;
}


export interface DeviceAttendancePayload {
  id?: string;
  userId?: number;
  uid?: number;
  timestamp?: Date | string;
  deviceUserId?: number;
  ip?: string;
  [key: string]: any;
}

export interface DeviceUserPayload {
  uid?: number;
  userId?: number | string;
  employeeNo?: number;
  id?: number | string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  privilege?: number;
  password?: string;
  enabled?: boolean;
  startDate?: string;
  endDate?: string;
  cardNo?: number;
  [key: string]: any;
}

export interface DeviceUser {
  uid: number; // Internal serial number
  userId: string; // Employee ID shown on device
  name: string;

  role?: number; // 0 = User, 3 = Admin
  password?: string;
  cardNo?: number;
  card?: number;
  group?: number;

  userTzFlag?: number;
  tz1?: number;
  tz2?: number;
  tz3?: number;
  privilege?: number;

  enabled?: boolean;
}
