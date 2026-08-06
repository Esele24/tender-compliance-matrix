/**
 * Reading environment variables safely.
 *
 * Env values look like clean strings and often aren't. They arrive from a
 * dashboard field someone pasted into, a `.env` file saved by an editor, or a
 * shell pipe — and any of those can leave behind a trailing newline or a
 * byte-order mark (U+FEFF), an invisible character that sits at the front of
 * the string.
 *
 * That invisible character caused two separate production failures here:
 *
 *   1. In an HTTP header, it threw "Cannot convert argument to a ByteString
 *      because the character at index 0 has a value of 65279". Headers are
 *      Latin-1 only, and 65279 is the BOM in decimal.
 *   2. In a URL, it produced "unexpected model name format" from the Gemini
 *      API — because the model name in the path was silently `﻿gemini-...`.
 *
 * Neither message mentions the real cause, which is what makes this worth
 * one shared function instead of a fix at each call site.
 */

/**
 * Read an env var, stripping anything outside printable ASCII.
 *
 * Use for values that go into a URL, a header, or an API key — all of which
 * are ASCII by definition. Do NOT use it for anything a human may legitimately
 * type non-ASCII into, such as a password; use `readEnvText` for those.
 */
export function readEnvAscii(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  // \x20-\x7E is space through tilde: every printable ASCII character.
  const cleaned = raw.replace(/[^\x20-\x7E]/g, "").trim();
  return cleaned === "" ? undefined : cleaned;
}

/**
 * Read an env var, trimming surrounding whitespace only.
 *
 * `String.prototype.trim()` treats U+FEFF as whitespace, so this removes a
 * stray BOM at either end while leaving the value's own characters intact.
 */
export function readEnvText(name: string): string | undefined {
  const cleaned = process.env[name]?.trim();
  return cleaned === "" ? undefined : cleaned;
}
