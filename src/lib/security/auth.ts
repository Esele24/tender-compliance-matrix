/**
 * Server-only Supabase authentication adapter. Read/write HTTP-only session cookies and
 * ask the provider to verify the user and claims. Then enforce invitations, MFA, and the
 * application database session; valid provider credentials alone do not grant access.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { authConfig, type Member } from "./config";
import { SecurityError } from "./errors";
import { checkSession } from "./store";
import { authorizeClaims } from "./claims";

// A cookie is a small value the browser sends with matching requests. Supabase
// uses cookies to carry session tokens, so users need not resend their password.
// httpOnly prevents browser JavaScript from reading the cookie; secure limits it to
// HTTPS in production; sameSite restricts cross-site use. await cookies() accesses
// this request's cookie collection, not a global shared session.
export async function authClient() {
  const { url, key } = authConfig();
  const jar = await cookies();
  return createServerClient(url, key, {
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }),
    },
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 28800,
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items)
            jar.set(name, value, {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "strict",
              path: "/",
              maxAge: value ? 28800 : 0,
            });
        } catch {
          /* Server components cannot refresh cookies; API handlers can. */
        }
      },
    },
  });
}

// Authentication asks "who are you?" Authorization asks "may you use this?"
// Supabase verifies identity; authorizeClaims checks the invitation and MFA level.
// MFA adds an authenticator code to password sign-in. checkSession additionally
// checks this app's stored session expiry/revocation. During MFA setup, false permits
// the password-authenticated stage; normal protected routes require the default true.
export async function identity(requireMfa = true): Promise<Member> {
  const client = await authClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.is_anonymous)
    throw new SecurityError(401, "sign_in", "Please sign in.");
  const { data: claims, error: claimError } = await client.auth.getClaims();
  if (claimError)
    throw new SecurityError(401, "sign_in", "Please sign in again.");
  const { member, sessionId } = authorizeClaims(
    data.user.id,
    claims?.claims,
    requireMfa,
  );
  if (requireMfa) await checkSession(sessionId);
  return member;
}
