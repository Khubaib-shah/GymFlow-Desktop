type LogLevel = 'info' | 'warn' | 'error';

class DeviceLogger {
  private log(level: LogLevel, message: string, details?: unknown): void {
    const prefix = '[ZKTECO]';
    const payload = details ? ` ${JSON.stringify(details)}` : '';
    const output = `${prefix} ${message}${payload}`;
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.info(output);
    }
  }

  info(message: string, details?: unknown) { this.log('info', message, details); }
  warn(message: string, details?: unknown) { this.log('warn', message, details); }
  error(message: string, details?: unknown) { this.log('error', message, details); }
}

export const deviceLogger = new DeviceLogger();
