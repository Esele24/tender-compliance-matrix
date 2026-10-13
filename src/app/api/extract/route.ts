/**
 * POST /api/extract turns one uploaded PDF into text and a page count, without an AI call.
 * The shared guard authenticates and limits processing; readForm bounds the entire upload
 * before pdfToText validates and parses the file in a separate Node worker.
 */
import { protectedRoute } from "@/lib/security/guard";
import { readForm } from "@/lib/security/body";
import { SecurityError } from "@/lib/security/errors";
import { pdfToText } from "@/lib/pdf-text";
export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = protectedRoute("extract_pdf", async (request) => {
  const form = await readForm(request),
    file = form.get("file");
  if (
    !(file instanceof File) ||
    [...form.keys()].length !== 1 ||
    file.name.length > 200
  )
    throw new SecurityError(
      400,
      "invalid_upload",
      "Upload one PDF with a short filename.",
    );
  return {
    ...(await pdfToText(new Uint8Array(await file.arrayBuffer()))),
    name: file.name,
  };
});
