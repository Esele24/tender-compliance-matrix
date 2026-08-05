import { NextResponse } from "next/server";
import { profileFromUrl } from "@/lib/profile-from-url";

export const maxDuration = 60;

export async function POST(request: Request) {
  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof url !== "string" || url.trim().length < 4) {
    return NextResponse.json(
      { error: "Paste the company's web address first." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await profileFromUrl(url.trim()));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    console.error("[profile]", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
