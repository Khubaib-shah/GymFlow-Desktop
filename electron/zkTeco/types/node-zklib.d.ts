declare module 'node-zklib' {
    interface DeviceInfo {
        model?: string;
        serialNumber?: string;
        firmwareVersion?: string;
        userCount?: number;
        attendanceCount?: number;
    }

    interface AttendanceLog {
        userId?: number;
        uid?: number;
        deviceUserId?: number;
        timestamp?: Date | string;
        attTime?: Date | string;
        checkInTime?: Date | string;
        [key: string]: any;
    }

    interface User {
        uid?: number;
        userId?: number;
        id?: number;
        employeeNo?: number;
        name?: string;
        password?: string;
        role?: number;
        [key: string]: any;
    }

    interface ZKLib {
        connect(): Promise<void>;
        disconnect(): Promise<void>;
        testConnection(): Promise<boolean>;
        getInfo(): Promise<DeviceInfo>;
        getAttendances(): Promise<{ data: AttendanceLog[] }>;
        getUsers(): Promise<{ data: User[] }>;
        setUser(uid: number, userId: number, name: string, password: string, role: number): Promise<void>;
        clearAttendanceLog(): Promise<void>;
        executeCmd(cmd: number, payload?: Buffer): Promise<any>;
    }

    interface ZKLibConstructor {
        new(ip: string, port: number, timeout: number, verbose: boolean): ZKLib;
    }

    const ZKLib: ZKLibConstructor;
    export = ZKLib;
}