import { DeviceError } from './errors/DeviceError';

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown device error';
}

export function normalizeSettings(raw: Partial<Record<string, any>> = {}): any {
  const port = Number(raw.port ?? raw.httpPort ?? 4370);
  const timeout = Number(raw.timeout ?? 10000);
  const pollInterval = Number(raw.pollInterval ?? 5000);
  return {
    enabled: Boolean(raw.enabled),
    deviceType: raw.deviceType || 'zkteco-k70',
    ip: String(raw.ip || '').trim(),
    port: Number.isFinite(port) ? port : 4370,
    timeout: Number.isFinite(timeout) ? timeout : 10000,
    pollInterval: Number.isFinite(pollInterval) ? pollInterval : 5000,
  };
}

export function createStructuredError(error: unknown) {
  if (error instanceof DeviceError) {
    return { success: false, error: error.message, code: error.code, details: error.details };
  }
  return { success: false, error: toErrorMessage(error), code: 'DEVICE_ERROR' };
}
