/**
 * Server-side boundary around PDF parsing. Reject oversized/non-PDF bytes first, then
 * run scripts/pdf-worker.cjs with a time limit and JavaScript heap limits. Every completion
 * path terminates the worker; callers receive extracted text or a safe rejection message.
 */
import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { SecurityError } from "./security/errors";
export type PdfExtraction = { text: string; pages: number };
// A worker thread runs parsing separately from the main server thread, so a
// difficult PDF cannot keep normal request handling busy indefinitely. workerData
// passes bytes in; worker message events deliver the result back. A Promise connects
// these events to await: resolve completes successfully; reject sends failure to catch.
// This extracts embedded text, not scanned handwriting/images; there is no OCR step.
export async function pdfToText(bytes: Uint8Array): Promise<PdfExtraction> {
  if (
    bytes.byteLength > 3 * 1024 * 1024 ||
    Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-"
  )
    throw new SecurityError(
      400,
      "invalid_pdf",
      "Upload a PDF within the 3 MB total upload limit.",
    );
  return new Promise((resolve, reject) => {
    const worker = new Worker(join(process.cwd(), "scripts/pdf-worker.cjs"), {
      // Keep binary data nested: bundlers may merge metadata into workerData.
      workerData: { bytes },
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 16,
        stackSizeMb: 4,
      },
    });
    let settled = false;
    const finish = (value?: PdfExtraction) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (value) resolve(value);
      else
        reject(
          new SecurityError(
            422,
            "pdf_rejected",
            "This PDF could not be safely read. Use a smaller text-based PDF (maximum 200 pages and 200,000 characters).",
          ),
        );
    };
    const timer = setTimeout(() => finish(), 10000);
    worker.on("message", (value) =>
      finish(value?.ok ? { text: value.text, pages: value.pages } : undefined),
    );
    worker.on("error", () => finish());
    worker.on("exit", () => {
      if (!settled) finish();
    });
  });
}
