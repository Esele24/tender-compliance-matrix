/**
 * PDF.js text extractor running outside the Next.js bundle in a separate Node thread.
 * It reads existing text objects (no OCR), preserves PDF line/page boundaries, and enforces
 * page/text limits. The parent controls lifetime; messages contain either text or failure.
 */
// This isolated worker is loaded directly by Node, outside the Next.js bundler.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parentPort, workerData } = require("node:worker_threads");
(async () => {
  await import("@napi-rs/canvas");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(workerData.bytes),
    useWorkerFetch: false,
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    if (doc.numPages > 200) throw new Error("Page limit");
    const pages = [];
    let length = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n),
        content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (typeof item.str !== "string") continue;
        length += item.str.length + 1;
        if (length > 200000) throw new Error("Text limit");
        // Honor hasEOL to keep continuation lines available to matrix line-range selection.
        text += item.str + (item.hasEOL ? "\n" : " ");
      }
      pages.push(text.trim());
      page.cleanup();
    }
    const text = pages.join("\n\n");
    if (text.trim().length < 100) throw new Error("No text");
    parentPort.postMessage({ ok: true, text, pages: doc.numPages });
  } finally {
    await task.destroy();
  }
})().catch(() => parentPort.postMessage({ ok: false }));
