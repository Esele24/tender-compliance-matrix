import { NextResponse } from "next/server";
import { getProfile, type CompanyProfile } from "@/lib/company";
import { buildMatrix } from "@/lib/matrix";

// Tenders are long and the model call is slow; don't let the platform cut it off.
export const maxDuration = 60;

/** A profile built from a URL arrives whole rather than by id. */
function asProfile(value: unknown): CompanyProfile | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Partial<CompanyProfile>;
  if (typeof p.name !== "string" || !Array.isArray(p.evidence)) return null;
  const evidence = p.evidence.filter(
    (e) => e && typeof e.source === "string" && typeof e.content === "string",
  );
  if (evidence.length === 0) return null;
  return {
    id: "from-url",
    name: p.name,
    caution: typeof p.caution === "string" ? p.caution : "",
    evidence,
  };
}

export async function POST(request: Request) {
  let tenderText: unknown;
  let profileId: unknown;
  let profile: unknown;
  try {
    ({ tenderText, profileId, profile } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof tenderText !== "string" || tenderText.trim().length < 100) {
    return NextResponse.json(
      { error: "Paste the tender text first — at least a few paragraphs." },
      { status: 400 },
    );
  }

  const company =
    asProfile(profile) ??
    getProfile(typeof profileId === "string" ? profileId : "");

  try {
    const matrix = await buildMatrix(tenderText, company);
    return NextResponse.json(matrix);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    console.error("[analyse]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
