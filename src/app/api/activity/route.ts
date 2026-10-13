/**
 * POST /api/activity rechecks access and records an export request through the shared
 * guard. The CSV stays in the browser: this endpoint receives only copy/download intent,
 * not report contents, and cannot confirm whether the browser export ultimately succeeds.
 */
import { z } from "zod";
import { readJson } from "@/lib/security/body";
import { protectedRoute } from "@/lib/security/guard";
export const POST = protectedRoute(
  "report_export_requested",
  async (request) => {
    z.object({ action: z.enum(["copy", "download"]) })
      .strict()
      .parse(await readJson(request, 1024));
    return { ok: true };
  },
);
