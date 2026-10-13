/**
 * POST /api/profile reads one administrator-approved website page and extracts company
 * evidence with AI. Sign the verified profile before returning it so later analysis can
 * detect browser edits, expiry, or reuse by a different account.
 */
import { z } from "zod";
import { protectedRoute } from "@/lib/security/guard";
import { readJson } from "@/lib/security/body";
import { signProfile } from "@/lib/security/evidence";
import { profileFromUrl } from "@/lib/profile-from-url";
export const maxDuration = 90;
export const POST = protectedRoute(
  "build_website_profile",
  async (request, member) => {
    const { url } = z
      .object({ url: z.string().min(4).max(2000) })
      .strict()
      .parse(await readJson(request, 4096));
    return signProfile(await profileFromUrl(url), member);
  },
  true,
);
