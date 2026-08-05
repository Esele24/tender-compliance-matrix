/**
 * Pull the text layer out of a PDF, server-side.
 *
 * Tenders arrive as PDFs, not as pasted text, so the demo stalls at exactly the
 * point a prospect wants to try their own document. This reads the text pdfjs
 * already has; it is NOT OCR. A scanned or photographed tender has no text
 * layer and must fail loudly rather than hand the model an empty string and
 * produce a confident matrix built on nothing.
 *
 * pdfjs is loaded lazily and from the legacy build: the legacy build is the one
 * that runs under Node without a browser worker, and deferring the import keeps
 * it out of the cold-start path for every other route.
 */

const MAX_CHARS = 200_000;

type TextItem = { str?: string; hasEOL?: boolean };

export type PdfExtraction = {
  text: string;
  pages: number;
};

export async function pdfToText(bytes: Uint8Array): Promise<PdfExtraction> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // No worker and no remote font fetches — this runs on the server.
  const task = pdfjs.getDocument({
    data: bytes,
    useWorkerFetch: false,
    useSystemFonts: false,
  });

  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    await task.destroy();
    const message = err instanceof Error ? err.message : "";
    if (/password/i.test(message)) {
      throw new Error(
        "That PDF is password-protected. Remove the password and try again.",
      );
    }
    throw new Error("That file couldn't be opened as a PDF.");
  }

  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();

    // Rebuild lines. pdfjs flags the last fragment of each visual line, and
    // clause numbering ("3.2 The bidder shall…") only survives if those breaks
    // are kept — run together, the requirements are far harder to separate.
    let text = "";
    for (const item of content.items as TextItem[]) {
      if (typeof item.str !== "string") continue;
      text += item.str;
      text += item.hasEOL ? "\n" : "";
    }
    page.cleanup();

    const cleaned = text
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (cleaned) pages.push(cleaned);
  }

  const numPages = doc.numPages;
  await task.destroy();

  const text = pages.join("\n\n").slice(0, MAX_CHARS);

  if (text.trim().length < 100) {
    throw new Error(
      "No readable text in that PDF — it looks like a scan or a set of images. Run it through OCR, or copy the text in by hand.",
    );
  }

  return { text, pages: numPages };
}
