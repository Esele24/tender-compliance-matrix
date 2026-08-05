/**
 * The compliance matrix — the whole point of step 1.
 *
 * Takes the raw text of a tender (ITT/RFQ) plus a company profile, and returns
 * every requirement mapped to the evidence that satisfies it, with anything
 * unsupported flagged as a GAP.
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: the model never invents a fact. It may
 * only quote evidence that appears in the supplied profile. Where nothing
 * matches, it must say GAP rather than filling the space with something
 * plausible. A hallucinated certification inside a submitted bid could get a
 * client blacklisted, so "we found no evidence for this" is a feature and it is
 * printed loudly.
 */

import type { CompanyProfile } from "./company";

export type Status = "MET" | "PARTIAL" | "GAP";

export type Requirement = {
  /** Verbatim from the tender, so the user can find it in their own document. */
  requirement: string;
  category:
    | "Corporate / legal"
    | "Financial"
    | "Technical"
    | "Experience"
    | "HSE"
    | "Personnel"
    | "Equipment"
    | "Local content"
    | "Other";
  mandatory: boolean;
  status: Status;
  /** Quoted from the profile. Empty string when status is GAP. */
  evidence: string;
  /** Which profile entry the evidence came from. Empty when GAP. */
  evidenceSource: string;
  /** One line: why this status. For a GAP, what is missing. */
  note: string;
};

export type MatrixResult = {
  requirements: Requirement[];
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          requirement: { type: "string" },
          category: {
            type: "string",
            enum: [
              "Corporate / legal",
              "Financial",
              "Technical",
              "Experience",
              "HSE",
              "Personnel",
              "Equipment",
              "Local content",
              "Other",
            ],
          },
          mandatory: { type: "boolean" },
          status: { type: "string", enum: ["MET", "PARTIAL", "GAP"] },
          evidence: { type: "string" },
          evidenceSource: { type: "string" },
          note: { type: "string" },
        },
        required: [
          "requirement",
          "category",
          "mandatory",
          "status",
          "evidence",
          "evidenceSource",
          "note",
        ],
      },
    },
  },
  required: ["requirements"],
};

function buildPrompt(tenderText: string, company: CompanyProfile): string {
  const profile = company.evidence
    .map((e) => `[${e.source}]\n${e.content}`)
    .join("\n\n");

  return `You are assisting a Nigerian oil and gas service company to respond to a tender. You are producing a COMPLIANCE MATRIX.

## Your two jobs

1. Read the tender document below and extract EVERY requirement a bidder must satisfy. Include qualification criteria, documents to submit, technical capability, certifications, financial thresholds, HSE standards, personnel, equipment, and Nigerian local content requirements. Extract each as a separate entry, quoting the tender's own wording. Do not merge two requirements into one. Do not skip a requirement because it seems minor or administrative.

2. For each requirement, decide whether the company evidence below satisfies it.

## The absolute rule

You may ONLY use the company evidence provided. You must NOT use general knowledge, industry norms, or assumptions about what a company like this probably has.

- If evidence directly satisfies the requirement, status is MET. Quote the relevant evidence VERBATIM in "evidence" and put its bracketed label in "evidenceSource".
- If evidence partly satisfies it — right category but wrong figure, expired date, narrower scope — status is PARTIAL. Quote what exists and say precisely what falls short in "note".
- If there is NO evidence for it, status is GAP. Set "evidence" to an empty string and "evidenceSource" to an empty string. In "note", say what document or fact the company must supply.

Never write evidence that does not appear verbatim in the profile. Never guess at a certificate number, a date, a figure, or a project. A GAP is the correct and useful answer when the company has not supplied something — it tells them what to go and find. Inventing a fact here could get the company disqualified or blacklisted, so an honest GAP is always better than a plausible sentence.

Set "mandatory" to true only where the tender uses obligatory language (shall, must, is required to, mandatory) or lists it as a qualification criterion. Otherwise false.

## Company evidence

${profile}

## Tender document

${tenderText}`;
}

export async function buildMatrix(
  tenderText: string,
  company: CompanyProfile,
): Promise<MatrixResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local in the project root.",
    );
  }

  // gemini-2.5-flash, not 2.0: this key's project has a free-tier quota of
  // literally 0 on gemini-2.0-flash (verified 2026-08-03), while 2.5-flash
  // serves fine. 2.5 is also the better fit — tenders are long and the matrix
  // needs careful reading rather than fast paraphrasing.
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(tenderText, company) }] }],
      generationConfig: {
        // Low temperature: this is extraction, not writing. We want the same
        // matrix twice from the same tender.
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Gemini returned ${res.status}. ${detail.slice(0, 400)}`,
    );
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error(
      "Gemini returned no usable content. The tender may have been blocked or truncated.",
    );
  }

  let parsed: MatrixResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned malformed JSON.");
  }
  if (!Array.isArray(parsed.requirements)) {
    throw new Error("Gemini response did not contain a requirements array.");
  }

  // Belt and braces: the schema permits a non-empty evidence string on a GAP.
  // Strip it, so a GAP row can never display something that looks like proof.
  for (const r of parsed.requirements) {
    if (r.status === "GAP") {
      r.evidence = "";
      r.evidenceSource = "";
    }
  }

  return parsed;
}
