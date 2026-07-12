import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { DEFAULT_DEVICE_SETTINGS } from './constants';
import type { ZkTecoDeviceSettings } from './types';
import { normalizeSettings } from './utils';

const SETTINGS_FILENAME = 'gymflow-zkteco-settings.json';

export class DeviceSettingsStore {
  private settingsPath: string;

  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), SETTINGS_FILENAME);
  }

  load(): ZkTecoDeviceSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const raw = fs.readFileSync(this.settingsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return normalizeSettings({ ...DEFAULT_DEVICE_SETTINGS, ...parsed });
      }
    } catch {
      // ignore and fall back
    }
    return { ...DEFAULT_DEVICE_SETTINGS };
  }

  save(settings: Partial<ZkTecoDeviceSettings>): ZkTecoDeviceSettings {
    const merged = normalizeSettings({ ...this.load(), ...settings });
    fs.writeFileSync(this.settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
    return merged;
  }

  isConfigured(settings?: ZkTecoDeviceSettings): boolean {
    const resolved = settings ?? this.load();
    return Boolean(resolved.enabled && resolved.ip);
  }
}

export const deviceSettingsStore = new DeviceSettingsStore();
