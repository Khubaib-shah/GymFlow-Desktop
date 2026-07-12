// =============================================================================
// Device Logger (ZKTeco)
// Structured logging for device operations
// =============================================================================

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

const LOG_PREFIX = "[ZKTECO]";

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(
  level: LogLevel,
  message: string,
  meta?: Record<string, any>,
): string {
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  return `${formatTimestamp()} ${LOG_PREFIX} [${level}] ${message}${metaStr}`;
}

export const deviceLogger = {
  info(message: string, meta?: Record<string, any>): void {
    console.log(formatMessage("INFO", message, meta));
  },

  warn(message: string, meta?: Record<string, any>): void {
    console.warn(formatMessage("WARN", message, meta));
  },

  error(message: string, meta?: Record<string, any>): void {
    console.error(formatMessage("ERROR", message, meta));
  },

  debug(message: string, meta?: Record<string, any>): void {
    if (process.env.NODE_ENV === "development") {
      console.log(formatMessage("DEBUG", message, meta));
    }
  },

  /** Log a successful device connection */
  connected(ip: string, model?: string): void {
    this.info("Connected to device", { ip, model });
  },

  /** Log a failed connection attempt */
  connectionFailed(ip: string, error: string): void {
    this.error("Failed to connect to device", { ip, error });
  },

  /** Log user creation on device */
  userCreated(employeeNo: number, name: string): void {
    this.info("User created on device", { employeeNo, name });
  },

  /** Log user creation failure */
  userCreateFailed(employeeNo: number, name: string, error: string): void {
    this.error("Failed to create user on device", { employeeNo, name, error });
  },

  /** Log user search */
  userSearched(count: number): void {
    this.info("User search completed", { resultCount: count });
  },

  /** Log sync operation */
  syncCompleted(
    matched: number,
    missingOnDevice: number,
    extraOnDevice: number,
  ): void {
    this.info("Sync completed", { matched, missingOnDevice, extraOnDevice });
  },

  /** Log attendance event */
  attendanceReceived(employeeNo: string, time: string): void {
    this.info("Attendance event received", { employeeNo, time });
  },

  /** Log an API request for debugging */
  apiRequest(method: string, path: string): void {
    this.debug(`${method} ${path}`);
  },

  /** Log an API response for debugging */
  apiResponse(method: string, path: string, status: number): void {
    this.debug(`${method} ${path} → ${status}`);
  },
};
