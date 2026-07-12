// =============================================================================
// Device Error Classes
// Typed errors for device communication failures
// =============================================================================

/** Base class for all device-related errors */
export class DeviceApiError extends Error {
  public readonly statusCode?: number;
  public readonly rawResponse?: string;

  constructor(message: string, statusCode?: number, rawResponse?: string) {
    super(message);
    this.name = "DeviceApiError";
    this.statusCode = statusCode;
    this.rawResponse = rawResponse;
  }
}

/** Device is not reachable on the network */
export class DeviceOfflineError extends DeviceApiError {
  constructor(ip: string, cause?: string) {
    super(`Device at ${ip} is offline or unreachable. ${cause || ""}`);
    this.name = "DeviceOfflineError";
  }
}

/** Digest authentication credentials are invalid */
export class AuthenticationFailedError extends DeviceApiError {
  constructor() {
    super("Authentication failed. Check device username and password.");
    this.name = "AuthenticationFailedError";
  }
}

/** Request to the device timed out */
export class TimeoutError extends DeviceApiError {
  constructor(timeoutMs: number) {
    super(`Device request timed out after ${timeoutMs}ms.`);
    this.name = "TimeoutError";
  }
}

/** Attempted to create a user with an employeeNo that already exists on the device */
export class DuplicateEmployeeNumberError extends DeviceApiError {
  public readonly employeeNo: number;

  constructor(employeeNo: number) {
    super(`Employee number ${employeeNo} already exists on the device.`);
    this.name = "DuplicateEmployeeNumberError";
    this.employeeNo = employeeNo;
  }
}

/** Generic network failure (DNS, socket, etc.) */
export class NetworkError extends DeviceApiError {
  constructor(cause: string) {
    super(`Network error communicating with device: ${cause}`);
    this.name = "NetworkError";
  }
}

/** User was not found on the device */
export class UserNotFoundError extends DeviceApiError {
  public readonly employeeNo: string;

  constructor(employeeNo: string) {
    super(`User with employeeNo ${employeeNo} was not found on the device.`);
    this.name = "UserNotFoundError";
    this.employeeNo = employeeNo;
  }
}

/**
 * Maps a raw fetch/network error to the appropriate typed DeviceError.
 * Used by device HTTP/SDK clients to wrap outgoing request failures.
 */
export function mapDeviceError(error: any, ip: string): DeviceApiError {
  const message = error?.message || String(error);

  // Timeout patterns
  if (
    message.includes("timeout") ||
    message.includes("ETIMEDOUT") ||
    message.includes("AbortError")
  ) {
    return new TimeoutError(10000);
  }

  // Connection refused / unreachable
  if (
    message.includes("ECONNREFUSED") ||
    message.includes("ECONNRESET") ||
    message.includes("ENETUNREACH") ||
    message.includes("EHOSTUNREACH") ||
    message.includes("fetch failed")
  ) {
    return new DeviceOfflineError(ip, message);
  }

  // Authentication
  if (message.includes("401") || message.includes("Unauthorized")) {
    return new AuthenticationFailedError();
  }

  // DNS
  if (message.includes("ENOTFOUND") || message.includes("getaddrinfo")) {
    return new NetworkError(`DNS resolution failed for ${ip}`);
  }

  // Fallback
  return new DeviceApiError(message, error?.statusCode);
}
