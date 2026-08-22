"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PROFILES, getProfile, type CompanyProfile } from "@/lib/company";
import { SAMPLE_TENDER } from "@/lib/sample-tender";
import { EXAMPLE_MATRIX, EXAMPLE_PROFILE_ID } from "@/lib/example-run";
import type { MatrixResult, Requirement, Status } from "@/lib/matrix";
import {
  deleteProfile,
  getSaved,
  listProfiles,
  saveProfile,
  type SavedProfile,
} from "@/lib/saved-profiles";

const FROM_URL = "from-url";
const FROM_DOCS = "from-docs";

/** Shown where the character count normally sits. The pre-loaded tender IS a
 *  real document, so the label names it — the reference is the point, since a
 *  buyer can look CW67348 up on NipeX and find it. */
const SAMPLE_TENDER_LABEL =
  "Renaissance Africa Energy — Slickline Services, Tender Ref CW67348";

/* ------------------------------------------------------------------ atoms */

const STATUS_TOKENS: Record<Status, { fg: string; wash: string; rail: string }> = {
  MET: { fg: "text-met", wash: "bg-met-wash", rail: "bg-met" },
  PARTIAL: { fg: "text-partial", wash: "bg-partial-wash", rail: "bg-partial" },
  GAP: { fg: "text-gap", wash: "bg-gap-wash", rail: "bg-gap" },
};

function StatusPill({ status }: { status: Status }) {
  const t = STATUS_TOKENS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${t.wash} ${t.fg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.rail}`} aria-hidden />
      {status}
    </span>
  );
}

/** Counts settle like a needle rather than snapping into place. */
function Readout({
  value,
  label,
  tone,
  delay = 0,
}: {
  value: number;
  label: string;
  tone: "neutral" | "met" | "partial" | "gap";
  delay?: number;
}) {
  const [shown, setShown] = useState(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current || value === 0) {
      setShown(value);
      return;
    }
    let frame = 0;
    const steps = 22;
    const timer = window.setInterval(() => {
      frame += 1;
      // ease-out so it decelerates into the final reading
      const p = 1 - Math.pow(1 - frame / steps, 3);
      setShown(Math.round(value * p));
      if (frame >= steps) window.clearInterval(timer);
    }, 18);
    return () => window.clearInterval(timer);
  }, [value]);

  const tones = {
    neutral: "text-ink",
    met: "text-met",
    partial: "text-partial",
    gap: "text-gap",
  };

  return (
    <div
      className="rise border-t-2 border-rule-strong bg-panel px-4 py-3.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={`font-mono text-[2rem] leading-none font-semibold tabular-nums ${tones[tone]}`}
      >
        {String(shown).padStart(2, "0")}
      </div>
      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </div>
    </div>
  );
}

/** One numbered step in the orientation strip above the controls. */
function Step({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="bg-panel px-4 py-3.5">
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[11px] font-semibold tabular-nums text-accent">
          {n}
        </span>
        <span className="text-sm font-semibold leading-snug">{title}</span>
      </div>
      <p className="mt-1.5 pl-[1.8rem] text-[12.5px] leading-relaxed text-ink-soft">
        {children}
      </p>
    </li>
  );
}

/* ------------------------------------------------------------------- page */

type Filter = "ALL" | Status;

export default function Home() {
  /* The page opens on a worked example rather than an empty form — see
     src/lib/example-run.ts for the reason. So the tender box arrives with the
     sample ITT in it, the evidence list arrives open, and a finished matrix is
     already on the page before anything is clicked. */
  const [tenderText, setTenderText] = useState(SAMPLE_TENDER);
  const [result, setResult] = useState<MatrixResult | null>(EXAMPLE_MATRIX);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(true);
  const [profileId, setProfileId] = useState(EXAMPLE_PROFILE_ID);
  const [siteUrl, setSiteUrl] = useState("");
  const [built, setBuilt] = useState<CompanyProfile | null>(null);
  const [building, setBuilding] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [copied, setCopied] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [source, setSource] = useState<string | null>(SAMPLE_TENDER_LABEL);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState<SavedProfile[]>([]);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<{ name: string; reason: string }[]>([]);

  const usingUrl = profileId === FROM_URL;
  const usingDocs = profileId === FROM_DOCS;
  const usingSaved = profileId.startsWith("saved:");
  /** A profile that was built (URL, documents) or restored from storage lives
   *  in `built`. Only the two bundled profiles come from getProfile — and it
   *  falls back to the sample, so it must not be reached with any other id. */
  const company =
    usingUrl || usingDocs || usingSaved ? built : getProfile(profileId);
  const reportRef = useRef<HTMLElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const docsRef = useRef<HTMLInputElement | null>(null);

  /* Whether the report on screen is the canned one. This is reference equality
     against the module singleton rather than a boolean flag, because every real
     run calls setResult with a freshly parsed object — so it cannot drift out of
     sync with what is actually displayed, and there is no reset to forget. */
  const isExample = result === EXAMPLE_MATRIX;

  /** Drop the canned report as soon as the tender it describes is edited away.
   *  Guarded, so it can never discard a matrix the user actually ran. */
  const clearExample = useCallback(
    () => setResult((r) => (r === EXAMPLE_MATRIX ? null : r)),
    [],
  );

  // localStorage is not available during SSR, so the list is read after mount.
  useEffect(() => setSaved(listProfiles()), []);

  const selectProfile = useCallback((id: string) => {
    setProfileId(id);
    setResult(null);
    setSavedNote(null);
    setSkipped([]);
    if (id.startsWith("saved:")) {
      const hit = getSaved(id);
      if (hit) {
        setBuilt(hit);
        setShowProfile(true);
      }
    } else if (id !== FROM_URL && id !== FROM_DOCS) {
      setBuilt(null);
    }
  }, []);

  /** Send a dropped or chosen PDF to the server and drop its text in the box. */
  async function loadPdf(file: File) {
    setExtracting(true);
    setError(null);
    setSource(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that PDF.");
      setTenderText(data.text as string);
      setSource(`${data.name} — ${data.pages} page${data.pages === 1 ? "" : "s"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that PDF.");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function buildFromUrl() {
    setBuilding(true);
    setError(null);
    setBuilt(null);
    setResult(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: siteUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that site.");
      setBuilt(data as CompanyProfile);
      setShowProfile(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that site.");
    } finally {
      setBuilding(false);
    }
  }

  /** Send the company's own PDFs up and build an evidence profile from them. */
  async function buildFromDocs(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBuilding(true);
    setError(null);
    setBuilt(null);
    setResult(null);
    setSavedNote(null);
    setSkipped([]);
    try {
      const body = new FormData();
      for (const f of Array.from(files)) body.append("files", f);
      const res = await fetch("/api/profile-docs", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read those documents.");
      const { skipped: bad = [], ...profile } = data as CompanyProfile & {
        skipped?: { name: string; reason: string }[];
      };
      setBuilt(profile as CompanyProfile);
      setSkipped(bad);
      setShowProfile(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read those documents.");
    } finally {
      setBuilding(false);
      if (docsRef.current) docsRef.current.value = "";
    }
  }

  /** Persist the current built profile so it survives a refresh. */
  function keepProfile() {
    if (!company) return;
    try {
      const entry = saveProfile(company);
      setSaved(listProfiles());
      setProfileId(entry.id);
      setBuilt(entry);
      setSavedNote(`Saved as "${entry.name}" — it will still be here next time.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that profile.");
    }
  }

  function forgetProfile(id: string) {
    deleteProfile(id);
    const remaining = listProfiles();
    setSaved(remaining);
    if (profileId === id) {
      setProfileId(PROFILES[0].id);
      setBuilt(null);
      setResult(null);
    }
    setSavedNote(null);
  }

  async function analyse() {
    setLoading(true);
    setError(null);
    setResult(null);
    setFilter("ALL");
    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenderText,
          profileId,
          // Anything not bundled has to travel with the request — the server
          // has no way to look up a profile that only exists in this browser.
          profile: usingUrl || usingDocs || usingSaved ? built : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setResult(data as MatrixResult);
      requestAnimationFrame(() =>
        reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const reqs: Requirement[] = useMemo(() => result?.requirements ?? [], [result]);
  const met = reqs.filter((r) => r.status === "MET").length;
  const partial = reqs.filter((r) => r.status === "PARTIAL").length;
  const gaps = reqs.filter((r) => r.status === "GAP").length;
  const blockers = reqs.filter((r) => r.status === "GAP" && r.mandatory).length;
  const shown = filter === "ALL" ? reqs : reqs.filter((r) => r.status === filter);

  function copyCsv() {
    const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const csv = [
      "Requirement,Category,Mandatory,Status,Evidence,Source,Note",
      ...reqs.map((r) =>
        [
          esc(r.requirement),
          esc(r.category),
          r.mandatory ? "YES" : "NO",
          r.status,
          esc(r.evidence),
          esc(r.evidenceSource),
          esc(r.note),
        ].join(","),
      ),
    ].join("\n");
    navigator.clipboard.writeText(csv).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  const canRun =
    !loading && !extracting && tenderText.trim().length >= 100 && !!company;

  return (
    <main className="min-h-screen">
      {/* ---------------------------------------------------------- header */}
      <header className="relative overflow-hidden border-b border-rule">
        <div className="blueprint pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-10 sm:px-8">
          <p className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            <span className="inline-block h-px w-8 bg-accent" aria-hidden />
            Tender response assistant
          </p>
          <h1 className="mt-4 max-w-3xl text-[2.1rem] leading-[1.06] font-semibold tracking-[-0.025em] text-balance sm:text-[3rem]">
            Every requirement, checked against what you can actually prove.
          </h1>
          <p className="mt-5 max-w-xl text-[1.02rem] leading-relaxed text-ink-soft">
            Drop in an invitation to tender — PDF or pasted text. Each
            requirement is pulled out and
            matched to your company&apos;s evidence — and anything you
            can&apos;t prove is flagged before the deadline, not after the bid
            is thrown out.
          </p>

          {/* Conditional so the anchor can never point at a section that has
              been cleared off the page. */}
          {isExample && (
            <p className="mt-5 border-l-2 border-accent pl-4 text-[13px] leading-relaxed text-ink-soft">
              <strong className="font-semibold text-ink">
                Nothing to set up — a worked example is already loaded.
              </strong>{" "}
              A real NipeX tender has been checked against a demo company, and
              the finished matrix is at the bottom of this page.{" "}
              <a
                href="#matrix"
                className="font-medium text-accent underline underline-offset-2 hover:opacity-70"
              >
                Jump to it ↓
              </a>{" "}
              — then swap in your own tender to run a real one.
            </p>
          )}

          {/* The order of operations, stated rather than implied. The numbered
              headings below say "01 / 02 / 03" but that only reads as a sequence
              to someone who already knows the tool. */}
          <ol className="mt-8 grid max-w-4xl gap-px border border-rule bg-rule sm:grid-cols-3">
            <Step n="01" title="Whose evidence?">
              Pick a company. Or build a profile from a company website, or from
              a folder of its certificates.
            </Step>
            <Step n="02" title="Which tender?">
              Drop the ITT in as a PDF, or paste the text — then press{" "}
              <span className="font-mono text-[11px] text-accent">
                Build matrix
              </span>
              .
            </Step>
            <Step n="03" title="Read the result">
              Every requirement, matched to evidence or flagged as a gap.
              Mandatory gaps are what get a bid thrown out.
            </Step>
          </ol>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        {/* ------------------------------------------------------- controls */}
        <section aria-labelledby="setup" className="grid gap-6 lg:grid-cols-[22rem_1fr]">
          <div className="space-y-4">
            <h2
              id="setup"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint"
            >
              01 — Company evidence
            </h2>
            <p className="-mt-2 text-[12.5px] leading-relaxed text-ink-soft">
              What the bidder can actually prove. The matrix may only quote from
              this list — nothing else.
            </p>

            <div className="border border-rule bg-panel p-4 shadow-[var(--shadow-panel)]">
              <label
                htmlFor="profile"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint"
              >
                Checking against
              </label>
              <select
                id="profile"
                value={profileId}
                onChange={(e) => selectProfile(e.target.value)}
                className="mt-2 w-full cursor-pointer border border-rule bg-panel-sunk px-3 py-2.5 text-sm transition-colors hover:border-rule-strong"
              >
                {PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                {saved.length > 0 && (
                  <optgroup label="Saved">
                    {saved.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Build a new one">
                  <option value={FROM_URL}>From a company website…</option>
                  <option value={FROM_DOCS}>From the company&apos;s documents…</option>
                </optgroup>
              </select>

              {usingDocs && (
                <div className="rise mt-3">
                  <input
                    ref={docsRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => buildFromDocs(e.target.files)}
                  />
                  <button
                    onClick={() => docsRef.current?.click()}
                    disabled={building}
                    className="relative w-full overflow-hidden border border-accent px-3 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-accent transition-all hover:bg-accent-wash disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {building ? "Reading documents" : "Choose PDFs"}
                    {building && <span className="sweep absolute inset-0" aria-hidden />}
                  </button>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                    Certificates, CAC registration, ISO, audited accounts, HSE
                    records, equipment register, past project references. Up to 8
                    PDFs. Every fact is cited back to its file, and nothing is
                    added that the documents don&apos;t say.
                  </p>
                </div>
              )}

              {skipped.length > 0 && (
                <ul className="rise mt-3 border-l-2 border-partial bg-partial-wash px-3 py-2">
                  {skipped.map((s) => (
                    <li key={s.name} className="text-[11px] leading-relaxed text-ink-soft">
                      <span className="font-mono">{s.name}</span> — skipped, {s.reason}
                    </li>
                  ))}
                </ul>
              )}

              {usingUrl && (
                <div className="rise mt-3 flex gap-2">
                  <input
                    type="url"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="pegisglobal.com"
                    className="min-w-0 flex-1 border border-rule bg-panel-sunk px-3 py-2 font-mono text-xs transition-colors focus:border-accent"
                  />
                  <button
                    onClick={buildFromUrl}
                    disabled={building || siteUrl.trim().length < 4}
                    className="relative overflow-hidden border border-accent px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-accent transition-all hover:bg-accent-wash disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {building ? "Reading" : "Build"}
                    {building && <span className="sweep absolute inset-0" aria-hidden />}
                  </button>
                </div>
              )}

              {company && (
                <>
                  <p className="mt-3 border-l-2 border-rule-strong pl-3 text-xs leading-relaxed text-ink-soft">
                    {company.caution}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                      onClick={() => setShowProfile((v) => !v)}
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent transition-opacity hover:opacity-70"
                    >
                      {showProfile ? "− Hide" : "+ Show"} {company.evidence.length} items
                    </button>

                    {/* Only a built profile is worth keeping — the two bundled
                        ones are already in the bundle. */}
                    {(usingUrl || usingDocs) && (
                      <button
                        onClick={keepProfile}
                        className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-accent"
                      >
                        ⌸ Save this profile
                      </button>
                    )}

                    {usingSaved && (
                      <button
                        onClick={() => forgetProfile(profileId)}
                        className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-gap"
                      >
                        ✕ Delete
                      </button>
                    )}
                  </div>

                  {savedNote && (
                    <p className="rise mt-2 border-l-2 border-met pl-3 text-[11px] leading-relaxed text-ink-soft">
                      {savedNote}
                    </p>
                  )}
                </>
              )}

              {showProfile && company && (
                <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {company.evidence.map((e, i) => (
                    <li
                      key={e.source + i}
                      className="rise border-l-2 border-accent/40 bg-panel-sunk px-3 py-2"
                      style={{ animationDelay: `${i * 25}ms` }}
                    >
                      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                        {e.source}
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-ink-soft">
                        {e.content}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
              02 — Tender document
            </h2>
            <p className="-mt-2 text-[12.5px] leading-relaxed text-ink-soft">
              The ITT or RFQ being bid. A real one is loaded already — clear it
              and paste your own, or drop a PDF onto the panel.
            </p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) loadPdf(file);
              }}
              className={`relative border bg-panel shadow-[var(--shadow-panel)] transition-colors ${
                dragging ? "border-accent" : "border-rule"
              }`}
            >
              <textarea
                id="tender"
                aria-label="Tender document text"
                value={tenderText}
                onChange={(e) => {
                  setTenderText(e.target.value);
                  setSource(null);
                  clearExample();
                }}
                rows={14}
                placeholder="Paste the full text of the ITT or RFQ here — or drop a PDF anywhere on this panel."
                className="w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed outline-none placeholder:text-ink-faint"
              />

              {(dragging || extracting) && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-panel/85 font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
                  {extracting ? "Reading the PDF" : "Drop the PDF"}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-panel-sunk px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint tabular-nums">
                  {source ?? `${tenderText.length.toLocaleString()} characters`}
                </span>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) loadPdf(file);
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={extracting}
                    className="border border-rule-strong px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {extracting ? "Reading…" : "Upload PDF"}
                  </button>
                  <button
                    onClick={() => {
                      setTenderText("");
                      setSource(null);
                      clearExample();
                    }}
                    disabled={tenderText.length === 0}
                    className="border border-rule-strong px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => {
                      setTenderText(SAMPLE_TENDER);
                      setSource(SAMPLE_TENDER_LABEL);
                      // The canned matrix IS this tender against this profile,
                      // so putting it back is the honest thing to show — but
                      // only while that profile is the one selected.
                      if (profileId === EXAMPLE_PROFILE_ID) setResult(EXAMPLE_MATRIX);
                    }}
                    className="border border-rule-strong px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors hover:border-accent hover:text-accent"
                  >
                    Load sample
                  </button>
                  <button
                    onClick={analyse}
                    disabled={!canRun}
                    className="relative overflow-hidden bg-accent px-5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition-all hover:bg-accent-hot disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {loading ? "Reading the tender" : "Build matrix →"}
                    {loading && <span className="sweep absolute inset-0" aria-hidden />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rise border-l-2 border-gap bg-gap-wash px-4 py-3 text-sm text-gap"
              >
                {error}
              </p>
            )}
          </div>
        </section>

        {/* --------------------------------------------------------- report */}
        {result && (
          <section ref={reportRef} id="matrix" className="mt-14 scroll-mt-6">
            {isExample && (
              <div className="mb-6 border-l-2 border-accent bg-accent-wash px-5 py-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
                  Worked example
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">
                  A <strong className="font-semibold text-ink">real tender</strong> —
                  Renaissance Africa Energy&apos;s slickline advert,{" "}
                  <span className="font-mono text-[11px]">CW67348</span> on NipeX,
                  which closed on 30 April 2026 — checked against a{" "}
                  <strong className="font-semibold text-ink">fictional company</strong>{" "}
                  invented for this demo. The tender is public and verifiable;
                  no real firm&apos;s capability data appears anywhere on this
                  page. Clear the tender box, paste your own, and press{" "}
                  <span className="font-mono text-[11px] text-accent">
                    Build matrix
                  </span>
                  .
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                03 — Compliance matrix
              </h2>
              <button
                onClick={copyCsv}
                className="border border-rule-strong px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors hover:border-accent hover:text-accent"
              >
                {copied ? "✓ Copied" : "Copy as CSV"}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-px bg-rule sm:grid-cols-4">
              <Readout value={reqs.length} label="Requirements" tone="neutral" />
              <Readout value={met} label="Met" tone="met" delay={60} />
              <Readout value={partial} label="Partial" tone="partial" delay={120} />
              <Readout value={gaps} label="Gaps" tone="gap" delay={180} />
            </div>

            {blockers > 0 && (
              <div className="stamp mt-5 flex items-start gap-4 border border-gap bg-gap-wash px-5 py-4">
                <span
                  className="mt-0.5 font-mono text-2xl leading-none font-bold text-gap tabular-nums"
                  aria-hidden
                >
                  {blockers}
                </span>
                <p className="text-sm leading-relaxed text-gap">
                  <strong className="font-semibold">
                    mandatory requirement{blockers === 1 ? "" : "s"} with no
                    supporting evidence.
                  </strong>{" "}
                  On most evaluations a missing mandatory item disqualifies the
                  bid before the technical section is read.
                </p>
              </div>
            )}

            {/* filters */}
            <div className="mt-6 flex flex-wrap gap-2">
              {(["ALL", "GAP", "PARTIAL", "MET"] as Filter[]).map((f) => {
                const n =
                  f === "ALL" ? reqs.length : reqs.filter((r) => r.status === f).length;
                const active = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    aria-pressed={active}
                    className={`border px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-all ${
                      active
                        ? "border-accent bg-accent text-white"
                        : "border-rule text-ink-soft hover:border-rule-strong"
                    }`}
                  >
                    {f === "ALL" ? "All" : f} <span className="tabular-nums">{n}</span>
                  </button>
                );
              })}
            </div>

            {/* matrix */}
            <div className="mt-4 overflow-x-auto border border-rule bg-panel shadow-[var(--shadow-panel)]">
              <table className="w-full min-w-[54rem] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-panel-sunk">
                  <tr className="border-b border-rule-strong text-left">
                    <th className="w-[42%] px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                      Requirement
                    </th>
                    <th className="w-28 px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                      Status
                    </th>
                    <th className="px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                      Evidence / what&apos;s missing
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr
                      key={`${r.requirement}-${i}`}
                      className="rise group border-b border-rule align-top last:border-0 transition-colors hover:bg-panel-sunk"
                      style={{ animationDelay: `${Math.min(i * 22, 500)}ms` }}
                    >
                      <td className="relative px-4 py-4">
                        <span
                          className={`absolute inset-y-0 left-0 w-[3px] transition-all group-hover:w-[5px] ${
                            STATUS_TOKENS[r.status].rail
                          }`}
                          aria-hidden
                        />
                        <p className="leading-relaxed">{r.requirement}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                            {r.category}
                          </span>
                          {r.mandatory && (
                            <span className="border border-ink-faint/40 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]">
                              Mandatory
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-4">
                        {r.evidence ? (
                          <>
                            <blockquote className="border-l-2 border-met/40 pl-3 text-[13px] leading-relaxed text-ink-soft">
                              {r.evidence}
                            </blockquote>
                            <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faint">
                              ↳ {r.evidenceSource}
                            </p>
                          </>
                        ) : (
                          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gap">
                            No evidence on file
                          </p>
                        )}
                        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                          {r.note}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 max-w-2xl border-l-2 border-rule-strong pl-4 text-[13px] leading-relaxed text-ink-soft">
              Every quoted line above appears verbatim in the company evidence
              listed at the top of this page. Nothing was written from general
              knowledge — where there was no evidence, the row says so.
            </p>
          </section>
        )}
      </div>

      <footer className="mt-16 border-t border-rule py-6">
        <div className="mx-auto max-w-6xl px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint sm:px-8">
          Compliance matrix · step 1
        </div>
      </footer>
    </main>
  );
}
