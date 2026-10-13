/**
 * Convert named source texts into an evidence profile. Check document counts, total text,
 * and unique source labels before asking Gemini for exact quotations. Verify those quotes
 * against the original texts before accepting the AI output.
 */
import { generateJson } from "./security/gemini";
import { verifiedProfile } from "./security/evidence";
import { SecurityError } from "./security/errors";
export type SourceDoc = { name: string; text: string };
// PROFILE JOURNEY: the upload route already extracted PDF text. Here docs is
// a list of document names/text. Gemini proposes evidence entries; verifiedProfile
// checks each entry really occurs in the named document. signProfile happens back
// in the API route after verification, so the browser cannot invent a trusted profile.
export async function profileFromDocs(docs: SourceDoc[]) {
  if (
    !docs.length ||
    docs.length > 8 ||
    docs.reduce((n, d) => n + d.text.length, 0) > 120_000
  )
    throw new SecurityError(
      413,
      "document_limit",
      "Upload at most eight documents and 120,000 extracted characters. Split larger sets; text will not be silently truncated.",
    );
  if (new Set(docs.map((d) => d.name)).size !== docs.length)
    throw new SecurityError(
      400,
      "duplicate_names",
      "Each document must have a distinct filename.",
    );
  const result = await generateJson(
    "Extract company evidence. Each source must be exactly one supplied document name. Each content field MUST be one continuous verbatim quotation from that document, never a paraphrase or a combination of passages. Keep dates and qualifying wording with each fact. Return the company name and evidence. Do not infer missing facts.",
    { documents: docs },
    {
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
    },
  );
  return verifiedProfile(result, docs);
}
