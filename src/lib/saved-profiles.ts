/**
 * Keep built profiles between visits.
 *
 * Until now a profile built from a website or from documents lived in React
 * state and died on refresh — so "check our company against this tender" was a
 * thing you could do once, never a thing you owned. That is the difference
 * between a demo and a tool somebody uses on a Tuesday.
 *
 * localStorage, deliberately, for now:
 *  - it is per-browser, so nothing leaves the user's machine. Given these
 *    profiles can contain certificate numbers and contract values, that is the
 *    right default until there is a real account model behind it.
 *  - the cost of the real answer (Supabase + auth + RLS) is a session's work,
 *    and it should be paid when there is a client, not before.
 *
 * Known limits, stated rather than discovered later: it does not sync across
 * devices, it is wiped by "clear browsing data", and there is no sharing. When
 * a paying client needs any of those, this module is the seam to replace — keep
 * the same four functions and swap the body.
 */

import type { CompanyProfile } from "./company";

const KEY = "tender-tool/profiles/v1";

export type SavedProfile = CompanyProfile & {
  /** Epoch ms, so the picker can show the most recent first. */
  savedAt: number;
};

function read(): SavedProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything malformed is dropped rather than crashing the page — a corrupt
    // entry from an older shape must not take the whole picker down.
    return parsed.filter(
      (p): p is SavedProfile =>
        !!p &&
        typeof p === "object" &&
        typeof (p as SavedProfile).id === "string" &&
        typeof (p as SavedProfile).name === "string" &&
        Array.isArray((p as SavedProfile).evidence),
    );
  } catch {
    return [];
  }
}

function write(profiles: SavedProfile[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profiles));
  } catch (err) {
    // Quota is the realistic failure: a few large profiles can fill the 5 MB
    // budget. Fail loudly at the call site rather than silently not saving.
    throw new Error(
      err instanceof DOMException && err.name === "QuotaExceededError"
        ? "Browser storage is full — delete a saved profile and try again."
        : "Couldn't save that profile.",
    );
  }
}

export function listProfiles(): SavedProfile[] {
  return read().sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Save under a stable id derived from the name, so re-running the same company
 * updates its entry instead of piling up near-duplicates. That is also what
 * makes "update what Pegis has" work: upload newer documents, save again, and
 * the profile is replaced rather than duplicated.
 */
export function saveProfile(profile: CompanyProfile, label?: string): SavedProfile {
  const name = (label ?? profile.name).trim() || "Untitled company";
  const id =
    "saved:" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const entry: SavedProfile = { ...profile, id, name, savedAt: Date.now() };
  const rest = read().filter((p) => p.id !== id);
  write([entry, ...rest]);
  return entry;
}

export function deleteProfile(id: string): void {
  write(read().filter((p) => p.id !== id));
}

export function getSaved(id: string): SavedProfile | undefined {
  return read().find((p) => p.id === id);
}
