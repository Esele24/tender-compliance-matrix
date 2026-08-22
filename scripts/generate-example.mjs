/**
 * Regenerates src/lib/example-matrix.json — the finished matrix the landing
 * page shows before anyone clicks anything.
 *
 * Run it when SAMPLE_TENDER or SAMPLE_COMPANY changes, otherwise the page will
 * claim the example is "the sample tender in panel 02" while showing a matrix
 * built from a different one.
 *
 *   npm run dev          # in one terminal
 *   node scripts/generate-example.mjs
 *
 * It posts to the real /api/analyse route rather than reimplementing the call,
 * so the committed example is produced by exactly the code path a live run
 * takes and cannot quietly diverge from it. Costs one Gemini request.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// SAMPLE_TENDER is a template literal in a .ts file, so it is read as text
// rather than imported — this script runs in plain node, with no TS step.
const src = readFileSync(join(root, "src/lib/sample-tender.ts"), "utf8");
const tenderText = src.slice(src.indexOf("`") + 1, src.lastIndexOf("`"));
if (tenderText.length < 500) {
  throw new Error("Could not read SAMPLE_TENDER — has the file's shape changed?");
}

const res = await fetch("http://localhost:3000/api/analyse", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tenderText, profileId: "sample" }),
});

const body = await res.text();
if (!res.ok) throw new Error(`${res.status}: ${body.slice(0, 600)}`);

const data = JSON.parse(body);
const tally = {};
for (const r of data.requirements) tally[r.status] = (tally[r.status] ?? 0) + 1;
console.log(`${data.requirements.length} requirements`, tally);

writeFileSync(
  join(root, "src/lib/example-matrix.json"),
  JSON.stringify(data, null, 2),
);
console.log("Wrote src/lib/example-matrix.json — update the header comment in example-run.ts.");
