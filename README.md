# Tender Compliance Matrix

**Paste in an oil & gas invitation to tender. Get an AI-generated requirement
checklist against a supplied company profile. Review it against the original
tender before using it in a bid.**

Nigerian oil servicing companies lose tenders on paperwork, not capability — a
missing certificate, an expired registration, a local-content clause nobody
mapped. An ITT carries dozens of scattered requirements and they get read by
hand, under deadline. This reads the document and builds the matrix.

Built for the NCDMB / NUPRC / NOGICD environment: it treats Nigerian Content
Execution Plans, NJQS product codes and CAC forms as first-class requirement
types.

## What it does

1. **Attempts to extract** requirements — qualification criteria, documents,
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
disqualified or blacklisted. So *"we found no evidence for this"* is a feature.

| Layer | What it does |
|---|---|
| **Prompt** | The model may only quote the supplied profile — no general knowledge, no assumptions about what a company like this probably has. |
| **Schema** | `temperature: 0` plus Gemini's structured JSON response schema. This improves consistency but does not guarantee identical or complete results. |
| **Post-parse checks** | A MET/PARTIAL quote must occur in the named profile entry or the row becomes a GAP for manual review. GAP rows always have evidence cleared. |

These checks verify quoted profile evidence, not whether the model found every
requirement or correctly judged that the evidence satisfies it.

## Current capabilities and limits

| Question | Current answer |
|---|---|
| AI-powered extraction? | Yes. Gemini reads tender text and generates the requirement matrix. The worked example is precomputed. |
| Arbitrary PDFs? | Text-based PDFs up to 25 MB can be uploaded. Scans need OCR first. Password-protected PDFs are rejected. |
| 100-page tenders? | Page count alone is not the limit. PDF extraction and Gemini may time out; text above 200,000 characters is rejected rather than silently truncated. Split long tenders and reconcile the sections manually. |
| Extraction accuracy? | Not measured on a labelled tender set. The tool cannot claim it finds every requirement. Check the matrix against the source tender. |
| How is MET decided? | Gemini judges whether profile evidence satisfies the wording. Code verifies that its quote appears in the named profile entry; it does not independently verify validity, expiry, or legal sufficiency. |
| Company evidence and real profiles? | Users can build profiles from a website or up to eight text-based PDF documents. Saved profiles live in that browser's localStorage, not a database. |
| Arbitrary websites? | It fetches the homepage and a few conventional paths. JavaScript-rendered, blocked, unusual, or missing pages may yield an incomplete profile. |
| Ambiguous information? | Gemini may mark it PARTIAL or GAP, but this is not guaranteed. A person must resolve ambiguous clauses and evidence. |
| Accounts and multiple employees? | No individual accounts. An optional shared HTTP Basic Auth password gates the demo. Profiles do not sync or support collaboration. |
| Persistence? | Saved company profiles persist in one browser until its local data is cleared. Tenders and matrices are not saved. |
| AI/API costs? | Live analyses and profile builds call Gemini under the operator's API key and may incur usage charges or quota limits. The precomputed example does not call Gemini. |
| CSV export? | The matrix can be copied as CSV or downloaded as a `.csv` file. |
| Confidential documents? | Uploaded text is sent to this app's server and then to Google's Gemini API. The demo password and browser storage do not provide a complete enterprise security model. Get the company's approval and assess hosting, access, retention, and provider terms before using confidential material. |

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
