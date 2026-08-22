import { NextResponse } from "next/server";
import { pdfToText } from "@/lib/pdf-text";
import { profileFromDocs, type SourceDoc } from "@/lib/profile-from-docs";

// Several PDFs to parse, then a model call over all of them.
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 8;

export async function POST(request: Request) {
  let files: File[];
  let companyName: string | undefined;

  try {
    const form = await request.formData();
    files = form.getAll("files").filter((f): f is File => f instanceof File);
    const nameField = form.get("companyName");
    companyName = typeof nameField === "string" && nameField.trim()
      ? nameField.trim()
      : undefined;
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "No documents were attached." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `That's ${files.length} files. Upload at most ${MAX_FILES} at a time.` },
      { status: 400 },
    );
  }

  const docs: SourceDoc[] = [];
  // One unreadable file among six shouldn't lose the other five — collect the
  // failures, carry on, and report them alongside the profile so the user knows
  // exactly which document did not make it in.
  const skipped: { name: string; reason: string }[] = [];

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      skipped.push({ name: file.name, reason: "over 25 MB" });
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Trust the magic number rather than the extension or the browser's guess.
    if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") {
      skipped.push({ name: file.name, reason: "not a PDF" });
      continue;
    }
    try {
      const { text } = await pdfToText(bytes);
      docs.push({ name: file.name, text });
    } catch (err) {
      skipped.push({
        name: file.name,
        reason: err instanceof Error ? err.message : "couldn't be read",
      });
    }
  }

  if (docs.length === 0) {
    return NextResponse.json(
      {
        error:
          "None of those files could be read. " +
          skipped.map((s) => `${s.name}: ${s.reason}`).join("; "),
      },
      { status: 422 },
    );
  }

  try {
    const profile = await profileFromDocs(docs, companyName);
    return NextResponse.json({ ...profile, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    console.error("[profile-docs]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
