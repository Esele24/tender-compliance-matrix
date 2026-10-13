/**
 * Website adapter for the document-profile pipeline. Read only the supplied approved
 * page (no crawling or browser JavaScript), remove scripts/styles/markup, and pass its
 * readable text to the same quotation checks used for uploaded company documents.
 */
import { allowedWebsite, safeWebsiteText } from "./security/safe-fetch";
import { profileFromDocs } from "./profile-from-docs";
import { SecurityError } from "./security/errors";
// The server downloads HTML, the markup describing a web page. replace calls
// use regular expressions to remove scripts/styles/tags and normalize basic text.
// This is not a full browser: JavaScript-rendered content may be absent. The resulting
// page text becomes one named document for the same evidence-extraction pipeline.
export async function profileFromUrl(raw: string) {
  const base = allowedWebsite(raw);
  const html = await safeWebsiteText(base.href);
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 200)
    throw new SecurityError(
      422,
      "website_empty",
      "This page did not contain enough readable information.",
    );
  const profile = await profileFromDocs([{ name: base.href, text }]);
  return {
    ...profile,
    caution:
      "Public website quotations only. A missing item means not published, not necessarily absent. Verify all evidence before submitting a bid.",
  };
}
