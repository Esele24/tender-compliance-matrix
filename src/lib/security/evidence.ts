/**
 * Validate evidence and protect profiles crossing the browser/server boundary. AI quotes
 * must occur in the named source text. A keyed SHA-256 signature binds accepted profile
 * fields to the user, tenant, and 30-minute expiry; it detects changes but does not encrypt data.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CompanyProfile } from "../company";
import type { Member } from "./config";
import { SecurityError, unavailable } from "./errors";

export const evidenceSchema = z
  .object({
    source: z.string().min(1).max(300),
    content: z.string().min(1).max(8000),
  })
  .strict();
export const profileSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    caution: z.string().max(2000),
    evidence: z.array(evidenceSchema).min(1).max(200),
    proof: z.string().max(1000).optional(),
  })
  .strict()
  .refine(
    (p) => p.evidence.reduce((n, e) => n + e.content.length, 0) <= 120_000,
  );

// Normalize Unicode and whitespace for comparison so PDF spacing differences do not reject a real quote.
const normal = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();
export function containsQuote(source: string, quote: string) {
  return normal(quote).length > 0 && normal(source).includes(normal(quote));
}

export function verifiedProfile(
  value: unknown,
  docs: { name: string; text: string }[],
): CompanyProfile {
  const parsed = z
    .object({
      name: z.string().min(1).max(200),
      evidence: z.array(evidenceSchema).min(1).max(200),
    })
    .strict()
    .parse(value);
  for (const entry of parsed.evidence) {
    const doc = docs.find((d) => d.name === entry.source);
    if (!doc || !containsQuote(doc.text, entry.content))
      throw new SecurityError(
        422,
        "unverified_evidence",
        "The AI returned evidence that could not be verified against its source. No profile was saved; review the original documents and retry.",
      );
  }
  return profileSchema.parse({
    id: "saved:verified-profile",
    name: docs.some((d) => containsQuote(d.text, parsed.name))
      ? parsed.name
      : "Company (name not verified)",
    caution:
      "Quotations were checked against the supplied text. Document authenticity, validity and compliance still require human review.",
    evidence: parsed.evidence,
  });
}

function signingKey(): string {
  const key = process.env.PROFILE_SIGNING_KEY;
  if (!key || !/^[a-f0-9]{64,}$/i.test(key)) return unavailable();
  return key;
}
// Serialize only signed fields in a fixed order; proof and browser-only savedAt are excluded.
function profilePayload(profile: CompanyProfile) {
  return JSON.stringify({
    id: profile.id,
    name: profile.name,
    caution: profile.caution,
    evidence: profile.evidence,
  });
}
// HMAC is a fingerprint computed with a secret key. Sign the same profile,
// user, tenant, and expiry again during verification; any changed value produces
// a different fingerprint. timingSafeEqual compares them without a normal early-exit
// comparison. The proof protects integrity, not truth: a quoted certificate can still
// be expired or unauthentic, and humans must check those questions.
function mac(profile: CompanyProfile, member: Member, expiry: string) {
  return createHmac("sha256", signingKey())
    .update(
      JSON.stringify([
        member.userId,
        member.tenantId,
        expiry,
        profilePayload(profile),
      ]),
    )
    .digest();
}
export function signProfile(
  profile: CompanyProfile,
  member: Member,
  now = Date.now(),
) {
  const expiry = String(now + 30 * 60_000);
  return {
    ...profile,
    proof: `${expiry}.${mac(profile, member, expiry).toString("hex")}`,
  };
}
// Validate shape/expiry before a constant-time MAC comparison. Rebuilding is required after any signed edit.
export function verifyProfile(
  value: unknown,
  member: Member,
  now = Date.now(),
): CompanyProfile {
  const profile = profileSchema.parse(value);
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(profile.proof ?? "");
  if (
    !match ||
    Number(match[1]) <= now ||
    Number(match[1]) > now + 30 * 60_000 ||
    !timingSafeEqual(
      Buffer.from(match[2], "hex"),
      mac(profile, member, match[1]),
    )
  )
    throw new SecurityError(
      403,
      "profile_expired",
      "This profile was changed, expired, or belongs to another account. Rebuild it from its source.",
    );
  return profile;
}
