import { EventEmitter } from 'events';
import type { DeviceAttendancePayload } from './types';

export class AttendanceSyncService extends EventEmitter {
  private lastSyncAt: Date | null = null;
  private seen = new Set<string>();

  markSynced(attendance: DeviceAttendancePayload[]): DeviceAttendancePayload[] {
    const unique = attendance.filter((item) => {
      const key = `${item.userId ?? item.uid ?? item.deviceUserId ?? 'unknown'}-${item.timestamp ?? item.attTime ?? ''}`;
      if (this.seen.has(key)) return false;
      this.seen.add(key);
      return true;
    });
    this.lastSyncAt = new Date();
    return unique;
  }

  getLastSyncAt(): Date | null {
    return this.lastSyncAt;
  }
}

export const attendanceSyncService = new AttendanceSyncService();
