/**
 * Manual live AI diagnostic using the bundled tender and fictional company. Requires
 * configured Gemini access and can incur provider usage. Print counts and quotation-check
 * results rather than the tender/evidence; set a failing exit status if generation fails.
 */
import { loadEnvConfig } from "@next/env";
import { buildMatrix } from "../src/lib/matrix";
import { SAMPLE_TENDER } from "../src/lib/sample-tender";
import { SAMPLE_COMPANY } from "../src/lib/company";
import { containsQuote } from "../src/lib/security/evidence";
loadEnvConfig(process.cwd());
async function main() {
  const result = await buildMatrix(SAMPLE_TENDER, SAMPLE_COMPANY);
  console.log(JSON.stringify({requirements:result.requirements.length, allRequirementsFromSource:result.requirements.every(r=>containsQuote(SAMPLE_TENDER,r.requirement)), statuses:result.requirements.reduce((counts,r)=>({...counts,[r.status]:(counts[r.status]??0)+1}),{} as Record<string,number>)}));
}
main().catch(error=>{console.error({code:error?.code??"sample_check_failed",type:error?.name??"Error"});process.exitCode=1;});
