/**
 * Server bridge to the migration-defined tender_security database RPC. Shared counters,
 * processing leases, audit metadata, and sessions work across application instances.
 * Hash bucket/session identifiers before storage; missing services block the operation.
 */
import { createHash, randomUUID } from "node:crypto";
import { SecurityError, unavailable } from "./errors";
import { authConfig } from "./config";
// Only a boolean RPC response is accepted. Timeouts, bad responses, or missing secrets fail closed.
// RPC means remote procedure call: call a database function over HTTP instead
// of sending arbitrary SQL. operation selects a permitted action; payload holds its
// arguments. The implementation lives in supabase/migrations/202609210001_security.sql.
// Shared database state matters because deployment may run multiple server instances;
// a JavaScript variable in one instance cannot limit traffic to all the others.
async function rpc(operation: string, payload: unknown): Promise<boolean> {
  const { url } = authConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return unavailable();
  try {
    const response = await fetch(url + "/rest/v1/rpc/tender_security", {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        apikey: key,
        ...(key.startsWith("sb_secret_")
          ? {}
          : { Authorization: "Bearer " + key }),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation, payload }),
    });
    if (!response.ok) return unavailable();
    const result = await response.json();
    if (typeof result !== "boolean") return unavailable();
    return result;
  } catch {
    return unavailable();
  }
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
// A bucket is a named quota, such as one user's requests per minute. The SQL
// function checks/increments counters atomically, so concurrent requests cannot both
// claim the last allowed request. Hashing makes a stable identifier without storing
// the raw key; it is not encryption and does not make guessable values secret.
export async function limit(
  buckets: { key: string; maximum: number; seconds: number }[],
) {
  if (
    !(await rpc("limit", {
      buckets: buckets.map((b) => ({ ...b, key: hash(b.key) })),
    }))
  )
    throw new SecurityError(
      429,
      "rate_limit",
      "Too many requests. Please wait before trying again.",
    );
}
export type AuditEvent = {
  requestId: string;
  action: string;
  outcome: string;
  userId?: string;
  tenantId?: string;
};
export async function audit(event: AuditEvent) {
  if (
    !(await rpc("audit", {
      requestId: event.requestId,
      action: event.action,
      outcome: event.outcome,
      userId: event.userId,
      tenantId: event.tenantId,
    }))
  )
    return unavailable();
}
// Return a release callback for the guard to invoke in finally. Database expiry also frees abandoned slots.
export async function processingLease(): Promise<() => Promise<void>> {
  const token = randomUUID();
  if (!(await rpc("acquire", { token })))
    throw new SecurityError(
      429,
      "busy",
      "All processing slots are busy. Please try again shortly.",
    );
  return async () => {
    await rpc("release", { token });
  };
}
export async function registerSession(sessionId: string) {
  if (!(await rpc("session_register", { key: hash(sessionId) })))
    return unavailable();
}
export async function checkSession(sessionId: string) {
  if (!(await rpc("session_check", { key: hash(sessionId) })))
    throw new SecurityError(
      401,
      "session_expired",
      "Your session expired. Sign in and verify your authenticator again.",
    );
}
export async function revokeSession(sessionId: string) {
  if (!(await rpc("session_revoke", { key: hash(sessionId) })))
    return unavailable();
}
