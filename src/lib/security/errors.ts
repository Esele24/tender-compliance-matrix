/**
 * Errors safe to expose to the browser: an HTTP status, stable code, and public message.
 * Unavailable configuration/services stop processing instead of silently disabling checks.
 */
export class SecurityError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function unavailable(): never {
  throw new SecurityError(
    503,
    "security_unavailable",
    "Security services are unavailable. Please try again later.",
  );
}
