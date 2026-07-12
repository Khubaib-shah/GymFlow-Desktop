export class DeviceError extends Error {
  constructor(message: string, public readonly code = 'DEVICE_ERROR', public readonly details?: unknown) {
    super(message);
    this.name = 'DeviceError';
  }
}
