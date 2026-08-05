import { NextResponse } from "next/server";
import { pdfToText } from "@/lib/pdf-text";

// A 200-page ITT takes a while to walk through.
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request) {
  let file: unknown;
  try {
    const form = await request.formData();
    file = form.get("file");
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is over 25 MB. Split it, or paste the relevant sections." },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Trust the magic number rather than the extension or the browser's guess.
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") {
    return NextResponse.json({ error: "That isn't a PDF." }, { status: 400 });
  }

  try {
    const { text, pages } = await pdfToText(bytes);
    return NextResponse.json({ text, pages, name: file.name });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't read that PDF.";
    console.error("[extract]", message);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
