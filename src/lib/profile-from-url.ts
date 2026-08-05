/**
 * Build a company evidence profile from a public website.
 *
 * This is what turns one demo into twenty. Instead of hand-typing a prospect's
 * capability data (which is how the Pegis profile was made), paste their URL and
 * get a profile in about a minute — then run a real tender against it and the
 * outreach message writes its own numbers.
 *
 * THE SAME RULE APPLIES AS EVERYWHERE ELSE: nothing is invented. The model may
 * only record claims the page actually makes. Where a page is silent, there is
 * no entry — and the matrix will correctly report a GAP. A profile padded with
 * "probably has ISO 9001" would produce a flattering matrix and a worthless one.
 */

import type { CompanyProfile, Evidence } from "./company";

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

/** Crude but sufficient: strip scripts, styles and tags, collapse whitespace. */
function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      // Some corporate sites return a stub to unknown agents.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`${url} returned ${res.status}.`);
  return htmlToText(await res.text());
}

const SUBPAGES = ["", "/about", "/about-us", "/services", "/capabilities", "/hse"];

export async function profileFromUrl(rawUrl: string): Promise<CompanyProfile> {
  let base: URL;
  try {
    base = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    throw new Error("That doesn't look like a valid web address.");
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error("Only http and https addresses are supported.");
  }

  // Grab the homepage plus a few conventional pages. Missing ones are normal —
  // ignore failures rather than aborting the whole build.
  const pages = await Promise.all(
    SUBPAGES.map(async (path) => {
      try {
        const text = await fetchText(new URL(path, base).toString());
        return text ? `[page: ${path || "/"}]\n${text}` : "";
      } catch {
        return "";
      }
    }),
  );

  const siteText = pages.filter(Boolean).join("\n\n").slice(0, 120_000);
  if (siteText.length < 200) {
    throw new Error(
      "Couldn't read enough from that site. It may be JavaScript-rendered or blocking automated requests — try pasting the company's capability statement text instead.",
    );
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const prompt = `Below is the text of a company's public website. Extract a factual evidence profile that could be used to check the company against a tender's requirements.

Record ONLY claims the website actually makes. Do not add anything from general knowledge, and do not infer. If the site does not mention certifications, financials, equipment or personnel, then simply do not create entries for those — a short, honest profile is correct and useful. A profile padded with assumptions produces a flattering compliance check and a worthless one.

Group related facts into entries. For each entry:
- "source": a short label describing where it came from, e.g. "Website — certifications listed" or "Website — services offered".
- "content": the claim in plain prose, staying close to the site's own wording. Include specifics — registration numbers, dates, standards, named clients, addresses — exactly as written.

Also return "name": the company's full legal name as the site states it.

Website text:

${siteText}`;

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
    throw new Error(`Gemini returned ${res.status}. ${(await res.text()).slice(0, 300)}`);
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
    throw new Error("Nothing usable was found on that site.");
  }

  return {
    id: "from-url",
    name: parsed.name?.trim() || base.hostname,
    caution: `Built automatically from ${base.hostname}. Public marketing copy only — treat gaps as "not published", not "does not exist".`,
    evidence: parsed.evidence,
  };
}
