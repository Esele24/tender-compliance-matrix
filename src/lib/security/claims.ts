/**
 * Application authorization after provider verification. Check claim identity and age,
 * match the user to the server-configured invitation list, and require aal2 (completed
 * MFA) for normal access. This module does not verify JWT signatures itself.
 */
import { z } from "zod";
import { members, type Member } from "./config";
import { SecurityError } from "./errors";

// A JWT is a signed token carrying claims (statements about the session).
// sub identifies the user, iat is issue time, exp is expiry, aal is authentication
// assurance level, and session_id identifies the session. Here timestamps use seconds,
// whereas Date.now() uses milliseconds. Only inspect claims after provider verification.
const claimsSchema = z.object({
  sub: z.uuid(),
  iat: z.number(),
  exp: z.number(),
  aal: z.string(),
  session_id: z.uuid(),
});

// Call only after the managed provider has verified the JWT signature and user.
export function authorizeClaims(
  userId: string,
  value: unknown,
  requireMfa = true,
  now = Date.now() / 1000,
): { member: Member; sessionId: string } {
  const result = claimsSchema.safeParse(value);
  if (
    !result.success ||
    result.data.sub !== userId ||
    result.data.exp <= now ||
    result.data.iat > now + 60 ||
    now - result.data.iat > 3600
  )
    throw new SecurityError(401, "sign_in", "Please sign in again.");
  const member = members().find((m) => m.userId === userId);
  if (!member)
    throw new SecurityError(
      403,
      "not_invited",
      "This account has not been invited.",
    );
  if (requireMfa && result.data.aal !== "aal2")
    throw new SecurityError(
      403,
      "mfa_required",
      "Complete authenticator verification to continue.",
    );
  return { member, sessionId: result.data.session_id };
}
