/**
 * POST /api/auth handles login, authenticator setup/challenge, verification, and logout.
 * Strict action schemas reject unrelated fields. Origin checks and database-backed
 * rate limits run before authentication work; protected processing requires completed MFA.
 */
import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authClient, identity } from "@/lib/security/auth";
import { readJson } from "@/lib/security/body";
import { checkMutation, errorResponse } from "@/lib/security/guard";
import { SecurityError } from "@/lib/security/errors";
import {
  audit,
  limit,
  registerSession,
  revokeSession,
} from "@/lib/security/store";

const inputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("login"),
      email: z.email().max(254),
      password: z.string().min(1).max(256),
    })
    .strict(),
  z.object({ action: z.literal("factor") }).strict(),
  z
    .object({
      action: z.literal("verify"),
      factorId: z.uuid(),
      challengeId: z.uuid(),
      code: z.string().regex(/^\d{6}$/),
    })
    .strict(),
  z.object({ action: z.literal("logout") }).strict(),
]);

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    checkMutation(request);
    await limit([
      { key: "auth-global", maximum: 120, seconds: 60 },
      { key: "auth-global-day", maximum: 1000, seconds: 86400 },
    ]);
    const input = inputSchema.parse(await readJson(request, 4096));
    const client = await authClient();
    // Revoke the application session as well as signing out of Supabase; clear browser cache/storage on success.
    if (input.action === "logout") {
      const { data: claims } = await client.auth.getClaims();
      if (typeof claims?.claims.session_id === "string")
        await revokeSession(claims.claims.session_id);
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error)
        throw new SecurityError(
          503,
          "logout_failed",
          "Sign-out failed. Close this browser tab and contact your administrator.",
        );
      return NextResponse.json(
        { ok: true },
        {
          headers: {
            "Cache-Control": "no-store",
            "Clear-Site-Data": '"cache", "storage"',
          },
        },
      );
    }
    // A password proves provider identity, then identity(false) checks the invitation before MFA starts.
    if (input.action === "login") {
      const emailHash = createHash("sha256")
        .update(input.email.toLowerCase())
        .digest("hex");
      await limit([{ key: `login:${emailHash}`, maximum: 5, seconds: 900 }]);
      const { error } = await client.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });
      if (error) {
        await audit({ requestId, action: "login", outcome: "denied" });
        throw new SecurityError(
          401,
          "login_failed",
          "Sign-in failed. Check your details or contact your administrator.",
        );
      }
      try {
        await identity(false);
      } catch {
        await client.auth.signOut({ scope: "local" });
        throw new SecurityError(
          403,
          "login_failed",
          "Sign-in failed. Check your details or contact your administrator.",
        );
      }
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const member = await identity(false);
    await limit([{ key: `mfa:${member.userId}`, maximum: 10, seconds: 900 }]);
    await audit({
      requestId,
      action: `auth_${input.action}`,
      outcome: "started",
      ...member,
    });
    // Reuse an enrolled authenticator, or replace unfinished enrollment and return setup details plus a challenge.
    if (input.action === "factor") {
      const { data, error } = await client.auth.mfa.listFactors();
      if (error) throw error;
      const verified = data.totp.find((f) => f.status === "verified");
      let factorId = verified?.id;
      let qr: string | undefined;
      let setupKey: string | undefined;
      if (!factorId) {
        for (const factor of data.all.filter(
          (f) => f.factor_type === "totp" && f.status === "unverified",
        ))
          await client.auth.mfa.unenroll({ factorId: factor.id });
        const enrollment = await client.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Tender tool authenticator",
        });
        if (enrollment.error) throw enrollment.error;
        factorId = enrollment.data.id;
        setupKey = enrollment.data.totp.secret;
        qr = enrollment.data.totp.qr_code.startsWith("data:")
          ? enrollment.data.totp.qr_code
          : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.data.totp.qr_code)}`;
      }
      const challenge = await client.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      return NextResponse.json(
        { factorId, challengeId: challenge.data.id, qr, setupKey },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    // Verify the one-time code, confirm upgraded aal2 claims, and only then register the application session.
    const result = await client.auth.mfa.verify({
      factorId: input.factorId,
      challengeId: input.challengeId,
      code: input.code,
    });
    if (result.error)
      throw new SecurityError(
        401,
        "mfa_failed",
        "The verification code was not accepted. Try again.",
      );
    const { data: verifiedClaims, error: claimsError } =
      await client.auth.getClaims();
    if (
      claimsError ||
      verifiedClaims?.claims.aal !== "aal2" ||
      typeof verifiedClaims.claims.session_id !== "string"
    )
      throw new SecurityError(
        401,
        "mfa_failed",
        "Authenticator verification failed. Sign in again.",
      );
    await audit({
      requestId,
      action: "login",
      outcome: "completed",
      ...member,
    });
    await registerSession(verifiedClaims.claims.session_id);
    await identity();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
