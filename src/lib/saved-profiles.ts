/**
 * Temporary browser-side profile cache held in module memory, with at most one entry.
 * Refresh loses the cache; reads remove entries older than 30 minutes. Legacy localStorage
 * helpers detect/delete copies left by an older version but never save new evidence there.
 */
import type { CompanyProfile } from "./company";
export type SavedProfile = CompanyProfile & { savedAt: number };
// This module-level array lives only in the browser's loaded JavaScript session.
// React state separately holds what the picker displays. saveProfile updates this
// cache; listProfiles returns a copy so callers do not mutate the array directly.
// Refreshing loads the module again with [], which explains why profiles disappear.
let profiles: SavedProfile[] = [];
const OLD_KEY = "tender-tool/profiles/v1";
export function clearLegacyProfiles() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(OLD_KEY);
    window.dispatchEvent(new Event("tender-legacy-cleared"));
  }
}
export function subscribeLegacy(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("tender-legacy-cleared", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("tender-legacy-cleared", listener);
  };
}
export function hasLegacyProfiles() {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem(OLD_KEY) !== null
    );
  } catch {
    return false;
  }
}
export function listProfiles() {
  profiles = profiles.filter((p) => Date.now() - p.savedAt < 30 * 60000);
  return [...profiles];
}
export function saveProfile(profile: CompanyProfile): SavedProfile {
  const entry = { ...profile, savedAt: Date.now() };
  profiles = [entry];
  return entry;
}
export function deleteProfile(id: string) {
  profiles = profiles.filter((p) => p.id !== id);
}
export function getSaved(id: string) {
  return listProfiles().find((p) => p.id === id);
}
export function clearProfiles() {
  profiles = [];
}
// Strip savedAt and any browser bookkeeping so the server receives exactly the signed profile contract.
export function profileForRequest(profile: CompanyProfile): CompanyProfile {
  return {
    id: profile.id,
    name: profile.name,
    caution: profile.caution,
    evidence: profile.evidence,
    proof: profile.proof,
  };
}
