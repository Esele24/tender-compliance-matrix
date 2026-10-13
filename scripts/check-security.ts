/**
 * Local configuration-shape check. Load Next.js environment files and report whether
 * required settings are present/valid without printing secrets. This does not contact
 * providers by default. --live also probes the security RPC without committing changes.
 */
import { loadEnvConfig } from "@next/env";
import {
  authConfig,
  members,
  origin,
  approvedForAI,
  evaluationForAI,
} from "../src/lib/security/config";
loadEnvConfig(process.cwd());
let failed = false;
function check(label: string, fn: () => unknown) {
  try {
    fn();
    console.log("PASS " + label);
  } catch {
    failed = true;
    console.log("MISSING OR INVALID " + label);
  }
}
check("canonical application origin", () => origin());
check("Supabase URL and publishable key", () => authConfig());
check("invited Pegis user IDs", () => members());
check("server-only Supabase secret key", () => {
  if (!process.env.SUPABASE_SECRET_KEY) throw new Error();
});
check("profile signing key", () => {
  if (!/^[a-f0-9]{64,}$/i.test(process.env.PROFILE_SIGNING_KEY ?? ""))
    throw new Error();
});
console.log(
  approvedForAI("pegis")
    ? "AI PROCESSING ENABLED: verify that written company approval is recorded."
    : evaluationForAI("pegis")
      ? "LOCAL NONCONFIDENTIAL EVALUATION ENABLED: company approval remains pending."
      : "AI PROCESSING DISABLED: expected while company approval is pending.",
);
async function finish() {
  if (process.argv.includes("--live") && !failed) {
    const { url } = authConfig();
    const key = process.env.SUPABASE_SECRET_KEY!;
    try {
      // Invalid buckets deliberately raise an exception in the installed RPC.
      // PostgreSQL rolls back the entire call, including its retention cleanup.
      const response = await fetch(url + "/rest/v1/rpc/tender_security", {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
        headers: {
          apikey: key,
          ...(key.startsWith("sb_secret_") ? {} : { Authorization: "Bearer " + key }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ operation: "limit", payload: { buckets: [] } }),
      });
      const result = await response.json();
      if (response.status === 400 && result?.code === "P0001" && result?.message === "Invalid buckets") {
        console.log("PASS live security database connection and RPC access (probe rolled back)");
      } else {
        failed = true;
        if (response.status === 401 || response.status === 403) {
          console.log("FAIL live security database: verify the server secret key and RPC permissions.");
        } else if (result?.code === "PGRST202") {
          console.log("FAIL live security database: apply supabase/migrations/202609210001_security.sql.");
        } else {
          console.log("FAIL live security database: unexpected RPC response (HTTP " + response.status + ").");
        }
      }
    } catch (error) {
      failed = true;
      const cause = error instanceof Error ? error.cause : undefined;
      const code = cause && typeof cause === "object" && "code" in cause ? cause.code : undefined;
      console.log(code === "ENOTFOUND"
        ? "FAIL live security database: SUPABASE_URL hostname does not resolve. Check the project URL and restore the project if paused."
        : "FAIL live security database: connection failed or timed out. Check project availability and network access.");
    }
  }
  console.log("No secret values were printed. Configuration checks do not replace real-account sign-in testing.");
  if (!process.argv.includes("--live")) console.log("Run npm run security:check -- --live to also check the security database connection.");
  process.exitCode = failed ? 1 : 0;
}
void finish();
