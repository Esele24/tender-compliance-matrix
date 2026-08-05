# Tender Compliance Matrix

**Paste in an oil & gas invitation to tender. Get back every requirement it
contains, each checked against a company's actual evidence, with anything
unproven flagged as a GAP.**

Nigerian oil servicing companies lose tenders on paperwork, not capability — a
missing certificate, an expired registration, a local-content clause nobody
mapped. An ITT carries dozens of scattered requirements and they get read by
hand, under deadline. This reads the document and builds the matrix.

Built for the NCDMB / NUPRC / NOGICD environment: it treats Nigerian Content
Execution Plans, NJQS product codes and CAC forms as first-class requirement
types.

## What it does

1. **Extracts** every requirement — qualification criteria, documents,
   certifications, financial thresholds, HSE, personnel, equipment, local
   content — quoting the tender's own wording so you can find it in the original.
2. **Classifies** each by category, and marks it mandatory when the tender uses
   obligatory language (*shall*, *must*, *is required to*).
3. **Matches** it against a company evidence profile:
   - **MET** — evidence directly satisfies it, quoted verbatim with its source
   - **PARTIAL** — right category, but wrong figure, expired date, or narrower scope
   - **GAP** — nothing in the profile supports it
4. **Flags mandatory GAPs** as disqualification risks — that's the row that
   loses the bid.

## The rule the whole thing is built around: it never invents evidence

A hallucinated certificate number inside a submitted bid could get a company
disqualified or blacklisted. So *"we found no evidence for this"* is a feature,
and it's enforced three separate times:

| Layer | What it does |
|---|---|
| **Prompt** | The model may only quote the supplied profile — no general knowledge, no assumptions about what a company like this probably has. |
| **Schema** | `temperature: 0` plus Gemini's strict `responseSchema`, so this is extraction rather than writing. The same tender produces the same matrix twice. |
| **Post-parse strip** | After parsing, any row with `status === "GAP"` has `evidence` and `evidenceSource` blanked — so even if the model ignored both instructions, a GAP row can never render something that looks like proof. |

The third layer exists because the first two are *requests* and the third is a
*guarantee*.

## Building a profile from a company website

Choose "A company website…", paste a URL, hit **Build profile**. It fetches the
homepage plus `/about`, `/services`, `/capabilities` and `/hse`, strips the
markup, and extracts an evidence profile — under the same never-invent rule as
the matrix: only claims the site actually makes.

Worth reading results honestly: a marketing website doesn't publish tax
clearance certificates, so a long GAP list from a URL-built profile reflects
what an outsider can verify, not what the company holds. The real use is against
a company's own document set.

## Sample data

A genuine public tender is included for testing:
`sample-tenders/Renaissance_Slickline_CW67348.pdf` — Renaissance Africa Energy,
Provision of Slickline Services, published via NipeX.

The built-in sample company profile and sample ITT are **fictional**, and
deliberately exercise all three statuses.

## Built with

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS**
- **Google Gemini** (`gemini-2.5-flash`) with a strict JSON response schema
- PDF text extraction for uploaded tender documents

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Click **Load sample tender**, then **Build compliance matrix**.

### Environment

Create `.env.local` in the project root:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash   # optional
```

Get a key from [Google AI Studio](https://aistudio.google.com/apikey).

> ⚠️ **Model gotcha.** Some API-key projects carry a free-tier quota of literally
> **0** on `gemini-2.0-flash` and `-lite`. A `429` whose body reads `limit: 0`
> means wrong model, not rate limiting — it won't clear by waiting.
> `gemini-2.5-flash`, `gemini-flash-latest` and `gemini-3-flash-preview` work.

## How the code is laid out

```
src/
├─ app/
│  ├─ page.tsx              UI — paste/upload a tender, render the matrix
│  └─ api/
│     ├─ extract/route.ts   PDF or pasted text  ->  plain text
│     ├─ profile/route.ts   company URL         ->  evidence profile
│     └─ analyse/route.ts   text + profile      ->  the matrix
└─ lib/
   ├─ matrix.ts             the core: prompt, schema, no-hallucination strip
   ├─ company.ts            CompanyProfile type — evidence items with sources
   ├─ pdf-text.ts           pulls text out of an uploaded PDF
   ├─ profile-from-url.ts   builds a profile by reading a company website
   └─ sample-tender.ts      the built-in demo tender
```

`lib/matrix.ts` is the file worth reading. Everything else feeds it or displays
what it returns.

## Status

Step 1 of a planned 5-step tender-response platform — deliberately the smallest
piece. Working end to end; `tsc --noEmit` clean and `next build` passes.

Planned next: document upload with retrieval, draft section generation with
source traceability, `.docx` export, multi-client accounts.

---

Built by [Esele Okogbo](https://eseleokogbo.vercel.app) · Port Harcourt, Nigeria
