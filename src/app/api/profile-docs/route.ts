/**
 * POST /api/profile-docs extracts text from one to eight company PDFs, builds a quoted
 * evidence profile with AI, then signs it for the requesting member. Files are read
 * sequentially; any extraction failure rejects this request rather than returning a partial set.
 */
import { protectedRoute } from "@/lib/security/guard";
import { readForm } from "@/lib/security/body";
import { SecurityError } from "@/lib/security/errors";
import { signProfile } from "@/lib/security/evidence";
import { pdfToText } from "@/lib/pdf-text";
import { profileFromDocs } from "@/lib/profile-from-docs";
export const runtime = "nodejs";
export const maxDuration = 180;
export const POST = protectedRoute(
  "build_document_profile",
  async (request, member) => {
    const form = await readForm(request),
      files = form.getAll("files");
    if (
      !files.length ||
      files.length > 8 ||
      [...form.keys()].some((k) => k !== "files") ||
      files.some((f) => !(f instanceof File) || f.name.length > 200)
    )
      throw new SecurityError(
        400,
        "invalid_upload",
        "Upload between one and eight PDFs with short, distinct filenames.",
      );
    const docs = [];
    for (const file of files as File[]) {
      const { text } = await pdfToText(
        new Uint8Array(await file.arrayBuffer()),
      );
      docs.push({ name: file.name, text });
    }
    return signProfile(await profileFromDocs(docs), member);
  },
  true,
);
