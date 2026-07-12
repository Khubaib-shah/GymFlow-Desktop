import { DeviceError } from './DeviceError';

export class ConnectionError extends DeviceError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}
