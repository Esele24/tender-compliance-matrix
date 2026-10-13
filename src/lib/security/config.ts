/**
 * Validate server environment settings and derive access/AI permissions. Invalid setup
 * throws an unavailable error so missing configuration blocks access. Membership currently
 * allows only the Pegis tenant; local admin evaluation has separate, explicit conditions.
 */
import { z } from "zod";
import { unavailable } from "./errors";

// Environment variables are configuration strings supplied to the running server.
// process.env reads them; an unset variable is undefined. Even flags are strings,
// so compare with "true", not the boolean true. Zod parses configuration into known
// shapes. tenantId groups users into an organization; role distinguishes admin/analyst.
const memberSchema = z
  .object({
    userId: z.uuid(),
    tenantId: z.string().regex(/^[a-z0-9-]{1,64}$/),
    role: z.enum(["admin", "analyst"]),
  })
  .strict();
export type Member = z.infer<typeof memberSchema>;

export function origin(): string {
  try {
    const url = new URL(process.env.APP_ORIGIN ?? "");
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return unavailable();
    if (
      url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        url.hostname === "localhost" &&
        url.protocol === "http:"
      )
    )
      return unavailable();
    return url.origin;
  } catch {
    return unavailable();
  }
}

export function members(): Member[] {
  try {
    const result = z
      .array(memberSchema)
      .min(1)
      .max(500)
      .parse(JSON.parse(process.env.ACCESS_MEMBERS ?? ""));
    if (
      new Set(result.map((m) => m.tenantId)).size !== 1 ||
      result.some((m) => m.tenantId !== "pegis") ||
      new Set(result.map((m) => m.userId)).size !== result.length
    )
      return unavailable();
    return result;
  } catch {
    return unavailable();
  }
}

export function approvedForAI(tenantId: string): boolean {
  return (
    process.env.AI_PROCESSING_ENABLED === "true" &&
    process.env.GEMINI_PAID_PROJECT_CONFIRMED === "true" &&
    (process.env.AI_APPROVED_TENANTS ?? "")
      .split(",")
      .map((s) => s.trim())
      .includes(tenantId)
  );
}

export function authConfig() {
  try {
    const url = new URL(process.env.SUPABASE_URL ?? "");
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (url.protocol !== "https:" || !key || /[\r\n]/.test(key))
      return unavailable();
    return { url: url.origin, key };
  } catch {
    return unavailable();
  }
}

// Explicit local evaluation permission is separate from company approval.
export function evaluationForAI(tenantId: string): boolean {
  return tenantId === "pegis" && process.env.NODE_ENV === "development" &&
    process.env.APP_ORIGIN === "http://localhost:3000" &&
    process.env.AI_PROCESSING_ENABLED === "true" &&
    process.env.GEMINI_PAID_PROJECT_CONFIRMED === "true" &&
    process.env.AI_NONCONFIDENTIAL_EVALUATION === "true";
}
export function permittedForAI(member: Member): boolean {
  return approvedForAI(member.tenantId) ||
    (member.role === "admin" && evaluationForAI(member.tenantId));
}
export function evaluationConsent(request: Request): boolean {
  return request.headers.get("X-Tender-Nonconfidential") === "confirmed";
}
