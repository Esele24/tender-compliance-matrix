/**
 * Build a company evidence profile from the company's OWN documents.
 *
 * This is the piece that separates a demo from a product. `profile-from-url.ts`
 * can only ever record what a company chose to publish on its marketing site,
 * which is why the Pegis run returned 15 GAPs — most of them were "not
 * published", not "does not exist". A firm's real certificates, audited
 * accounts and project references live in PDFs, and until those can go in, the
 * matrix understates every real company it is pointed at.
 *
 * THE NO-INVENTION RULE IS THE WHOLE PRODUCT, and it matters more here than
 * anywhere else in this codebase. A hallucinated certificate number on a
 * capability profile does not stay in the tool — it gets copied into a bid and
 * submitted to an operator. So: the model may only record what the documents
 * actually say, every entry must name the file it came from, and where the
 * documents are silent there is no entry.
 *
 * `source` carries the real filename precisely so a GAP can be argued with:
 * "your matrix says no ISO — it came from ISO-9001-cert.pdf" is a conversation
 * the user can have. "Source: documents" is not.
 */

import type { CompanyProfile, Evidence } from "./company";
import { readEnvAscii } from "./env";

/** Roughly 120k chars, same ceiling profile-from-url.ts uses for site text. */
const MAX_CHARS = 120_000;

export type SourceDoc = {
  /** Original filename — becomes part of the citation. */
  name: string;
  text: string;
};

const PROFILE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          content: { type: "string" },
        },
        required: ["source", "content"],
      },
    },
  },
  required: ["name", "evidence"],
};

/**
 * Interleave the documents with clear filename delimiters. The model has to be
 * able to attribute every claim back to one file, so the boundaries cannot be
 * ambiguous — and a document that blows the budget is truncated visibly rather
 * than silently dropped.
 */
function assemble(docs: SourceDoc[]): string {
  const budget = Math.floor(MAX_CHARS / Math.max(docs.length, 1));
  return docs
    .map((d) => {
      const body =
        d.text.length > budget
          ? d.text.slice(0, budget) + "\n[... truncated ...]"
          : d.text;
      return `=== FILE: ${d.name} ===\n${body}`;
    })
    .join("\n\n");
}

export async function profileFromDocs(
  docs: SourceDoc[],
  companyName?: string,
): Promise<CompanyProfile> {
  const usable = docs.filter((d) => d.text.trim().length > 50);
  if (usable.length === 0) {
    throw new Error("None of those documents had readable text in them.");
  }

  const corpus = assemble(usable);

  // Same sanitising as matrix.ts and profile-from-url.ts — the key becomes a
  // header and the model becomes part of the URL, so neither tolerates a BOM.
  const key = readEnvAscii("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const model = readEnvAscii("GEMINI_MODEL") ?? "gemini-2.5-flash";

  const prompt = `Below are the full texts of documents belonging to one company — certificates, registrations, audited accounts, HSE records, CVs, equipment registers, past project references, or similar. Extract a factual evidence profile that can be checked against a tender's requirements.

RULES, IN ORDER OF IMPORTANCE:

1. Record ONLY what the documents actually state. Do not infer, do not round, do not complete a partial fact from general knowledge, and never invent a registration number, certificate number, date or monetary figure. If a document mentions a certificate but does not give its number or expiry, record exactly that much and no more.
2. Every entry's "source" MUST name the specific file the fact came from, exactly as it appears after "=== FILE:". Format it as "<filename> — <what it is>", for example "NOGIC-certificate.pdf — NCDMB registration". If one entry draws on two files, name both.
3. If the documents are silent on certifications, financials, equipment, personnel or experience, simply create no entry for those. A short honest profile is correct and useful. A profile padded with assumptions produces a flattering compliance check and a worthless one.
4. Copy specifics verbatim where they exist — registration numbers, certificate numbers, issue and expiry dates, standards, contract values, client names, man-hours, addresses.
5. Where a document states an expiry date, always include it. An expired certificate is a different answer from a current one and the matrix has to be able to tell them apart.

Group related facts into entries. "content" should read as plain prose, phrased as it would appear in a bid.

Also return "name": the company's full legal name exactly as the documents state it.${
    companyName
      ? ` If the documents do not state it, use "${companyName}".`
      : ""
  }

Documents:

${corpus}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: PROFILE_SCHEMA,
        },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(
      `Gemini returned ${res.status}. ${(await res.text()).slice(0, 300)}`,
    );
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("Gemini returned no usable content.");

  let parsed: { name?: string; evidence?: Evidence[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned malformed JSON.");
  }
  if (!Array.isArray(parsed.evidence) || parsed.evidence.length === 0) {
    throw new Error("Nothing usable was found in those documents.");
  }

  const filenames = usable.map((d) => d.name).join(", ");

  return {
    id: "from-docs",
    name: parsed.name?.trim() || companyName?.trim() || "Uploaded company",
    caution: `Built from ${usable.length} uploaded document${
      usable.length === 1 ? "" : "s"
    } (${filenames}). Every entry cites its file — check any figure against the original before it goes into a bid.`,
    evidence: parsed.evidence,
  };
}
