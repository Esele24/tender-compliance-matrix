/**
 * POST /api/analyse accepts tender text and reviewed company evidence, then returns
 * a compliance matrix. The fictional bundled profile is trusted locally; a custom profile
 * must carry a valid server signature for this user and tenant. The guard enables AI checks.
 */
import { evaluationForAI } from "@/lib/security/config";
import { z } from "zod";
import { SAMPLE_COMPANY } from "@/lib/company";
import { buildMatrix } from "@/lib/matrix";
import { protectedRoute } from "@/lib/security/guard";
import { readJson } from "@/lib/security/body";
import { verifyProfile } from "@/lib/security/evidence";
import { SecurityError } from "@/lib/security/errors";
export const maxDuration = 120;
// ANALYSE JOURNEY, 2: Next.js maps this route.ts to /api/analyse and calls POST
// for a POST request. Request holds the headers/body sent by fetch in the browser.
// protectedRoute is a higher-order function: it takes our handler and returns a
// new handler that runs shared safeguards first. The final true marks AI usage.
// member comes from verified server identity, never from the submitted JSON.
export const POST = protectedRoute(
  "analyse_tender",
  async (request, member) => {
    // Zod validates at runtime. z.string().min(100).max(200000) checks text length;
    // .strict() rejects extra fields; .parse() returns valid data or throws an error.
    // TypeScript alone cannot check network data because its types disappear at runtime.
    // readJson first limits body bytes. Length limits also bound processing cost.
    const input = z
      .object({
        tenderText: z.string().trim().min(100).max(200000),
        profileId: z.string().max(100),
        profile: z.unknown().optional(),
        reviewed: z.literal(true).optional(),
      })
      .strict()
      .parse(await readJson(request));
    // Only the explicitly authorized local admin evaluation replaces checkboxes
    // with authorization on the processing action. Production still requires review.
    if (!(member.role === "admin" && evaluationForAI(member.tenantId)) && input.reviewed !== true)
      throw new SecurityError(400, "review_required", "Review the company evidence before building a matrix.");
    const company = input.profile
      ? verifyProfile(input.profile, member)
      : input.profileId === SAMPLE_COMPANY.id
        ? SAMPLE_COMPANY
        : null;
    if (!company)
      throw new SecurityError(
        400,
        "profile",
        "Choose the fictional sample or rebuild a verified company profile.",
      );
    // Next hop: src/lib/matrix.ts. Returning its Promise lets the wrapper await
    // completion, audit success, and send {requirements: [...]} as JSON to the browser.
    // If it throws, the wrapper sends a safe error response instead of a report.
    return buildMatrix(input.tenderText, company);
  },
  true,
);
