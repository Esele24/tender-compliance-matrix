/**
 * Bounded request readers shared by API routes and the AI response reader. Count actual
 * stream bytes rather than trusting Content-Length, cancel slow/oversized reads, and
 * parse JSON or multipart data only after the full body is within its allowed size.
 */
import { SecurityError } from "./errors";

// HTTP bodies arrive as a stream of byte chunks, not necessarily one complete
// string. The reader pulls chunks until done, counts their sizes, then joins them.
// A Uint8Array holds bytes; TextDecoder later turns UTF-8 bytes into text for JSON.
// Multipart instead carries file bytes plus named form fields in one request.
export async function readBytes(
  request: Request,
  maximum: number,
): Promise<Uint8Array> {
  // Reject oversized declared lengths early, but also count streamed bytes because headers can be missing or false.
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximum))
    throw new SecurityError(413, "body_too_large", "This upload is too large.");
  if (!request.body)
    throw new SecurityError(400, "empty_body", "A request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const timer = setTimeout(() => {
    void reader.cancel();
  }, 15_000);
  let finished = false;
  const deadline = Date.now() + 15_000;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (Date.now() >= deadline)
        throw new SecurityError(408, "read_timeout", "The upload timed out.");
      if (done) {
        finished = true;
        break;
      }
      total += value.byteLength;
      if (total > maximum)
        throw new SecurityError(
          413,
          "body_too_large",
          "This upload is too large.",
        );
      chunks.push(value);
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } finally {
    clearTimeout(timer);
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function readJson(
  request: Request,
  maximum = 1_000_000,
): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new SecurityError(415, "content_type", "Expected a JSON request.");
  const bytes = await readBytes(request, maximum);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new SecurityError(400, "invalid_json", "Invalid JSON request.");
  }
}

// This is the total multipart request cap, including all files and multipart overhead.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export async function readForm(request: Request): Promise<FormData> {
  const type = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(type))
    throw new SecurityError(415, "content_type", "Expected a document upload.");
  const bytes = await readBytes(request, MAX_UPLOAD_BYTES);
  try {
    return await new Response(bytes as BodyInit, {
      headers: { "Content-Type": type },
    }).formData();
  } catch {
    throw new SecurityError(400, "invalid_form", "Invalid document upload.");
  }
}
