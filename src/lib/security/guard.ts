/**
 * Shared wrapper for processing endpoints. Check same-origin requests, authenticate the
 * member, enforce quotas/AI permissions, audit metadata, and acquire a processing slot.
 * Translate failures into safe JSON and release the slot in finally, even when work throws.
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { identity } from "./auth";
import { approvedForAI, permittedForAI, evaluationConsent, origin, type Member } from "./config";
import { SecurityError } from "./errors";
import { audit, limit, processingLease } from "./store";

// Same origin means the same protocol, hostname, and port. These checks help
// block another website from submitting actions using the user's session cookies
// (cross-site request forgery). The custom header is a request marker, not a password
// or authentication token; identity() must still establish who is making the request.
export function checkMutation(request: Request) {
  if (request.method !== "POST")
    throw new SecurityError(405, "method", "Method not allowed.");
  if (
    request.headers.get("origin") !== origin() ||
    request.headers.get("x-tender-request") !== "1"
  )
    throw new SecurityError(
      403,
      "origin",
      "This request did not originate from the application.",
    );
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin")
    throw new SecurityError(
      403,
      "origin",
      "Cross-site requests are not allowed.",
    );
}

export function errorResponse(error: unknown, requestId: string) {
  const safe =
    error instanceof SecurityError
      ? error
      : error instanceof ZodError
        ? new SecurityError(
            400,
            "validation",
            "Some supplied information is invalid or exceeds the allowed limits.",
          )
        : new SecurityError(
            502,
            "processing_failed",
            "Processing failed. Please retry or ask your administrator, quoting the request reference.",
          );
  return NextResponse.json(
    { error: safe.message, code: safe.code, requestId },
    {
      status: safe.status,
      headers: {
        "Cache-Control": "no-store",
        ...(safe.status === 429 ? { "Retry-After": "60" } : {}),
      },
    },
  );
}

// A wrapper avoids repeating the same checks in every API file. handler is a
// function supplied by that route; only await handler(request, member) runs its work.
// Promise<unknown> means it will eventually return a value we have not typed here.
// A requestId ties audit entries and browser errors together without logging documents.
// HTTP 401 means sign-in is needed, 403 means access denied, 429 means too many
// requests, and 503 means a required service/setup is unavailable.
export function protectedRoute(
  action: string,
  handler: (request: Request, member: Member) => Promise<unknown>,
  ai = false,
) {
  return async (request: Request) => {
    const requestId = randomUUID();
    let member: Member | undefined;
    let release: (() => Promise<void>) | undefined;
    try {
      checkMutation(request);
      member = await identity(); // Every route checks auth; proxy is never the security boundary.
      await limit([
        { key: `user:${member.userId}`, maximum: 12, seconds: 60 },
        { key: `tenant:${member.tenantId}`, maximum: 120, seconds: 3600 },
        { key: "all-processing", maximum: 500, seconds: 86400 },
      ]);
      if (ai && !permittedForAI(member))
        throw new SecurityError(
          403,
          "ai_not_approved",
          "AI processing is disabled until your administrator confirms provider billing and company approval.",
        );
      if (ai && !approvedForAI(member.tenantId) && !evaluationConsent(request))
        throw new SecurityError(403, "evaluation_consent", "Confirm that this submission contains only nonconfidential information and may be sent to Google Gemini.");
      await audit({ requestId, action, outcome: "started", ...member });
      release = await processingLease();
      const data = await handler(request, member);
      await audit({ requestId, action, outcome: "completed", ...member });
      return NextResponse.json(data, {
        headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
      });
    } catch (error) {
      // Deliberately do not log upstream exception messages, bodies or document contents.
      if (member) {
        // Sample repeated failures so an abusive member cannot flood audit storage.
        await limit([
          { key: `failure-audit:${member.userId}`, maximum: 1, seconds: 60 },
        ])
          .then(() =>
            audit({
              requestId,
              action,
              outcome: error instanceof SecurityError ? error.code : "failed",
              ...member,
            }),
          )
          .catch(() => {});
      }
      return errorResponse(error, requestId);
    // finally runs after success or failure. release is a function that frees the
    // database processing slot. ?. skips it if no slot was acquired; .catch(() => {})
    // prevents cleanup failure from replacing the result/error already being returned.
    // The database also expires leases so a crashed server cannot hold a slot forever.
    } finally {
      await release?.().catch(() => {});
    }
  };
}
