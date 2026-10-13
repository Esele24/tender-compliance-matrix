# Tender Compliance Matrix

A private tender-review assistant for Esele and specifically invited Pegis staff. It extracts requirements, compares them with company evidence, and prepares a reviewable compliance matrix. It does not certify compliance or guarantee complete extraction.

## Current security status

The application now requires individual Supabase accounts, authenticator verification, a server-side Pegis allowlist, and durable security controls in Supabase Postgres. Missing security configuration blocks access. A shared demo password is no longer supported. No Redis account is needed.

**Pegis approval of Gemini processing is pending. AI operations remain disabled.** Billing alone does not enable processing. Read [SECURITY.md](SECURITY.md) for the exact activation steps and outstanding deployment checks.

## Features and limits

- Fictional company and precomputed public-tender example. Real-company profiles are not bundled into client code.
- PDF extraction: eight files at most for company profiles, 3 MB total upload body including multipart overhead, 200 pages and 200,000 extracted characters per PDF. Text-based PDFs only; no OCR. One unreadable document rejects the set instead of silently omitting evidence.
- Company profiles: at most 120,000 source characters. Every evidence item must be a quotation found in its named source. Profiles are signed, account-bound and expire after 30 minutes.
- Website profiles: one explicitly approved HTTPS page. Exact hostname allowlist, public-address validation and pinning, no redirects, bounded response size and time. Sites requiring redirects or JavaScript may not work.
- Matrix generation: structured and validated AI output; quotations checked against tender and profile text. Unsupported evidence becomes GAP. Document authenticity, expiry interpretation and requirement coverage still need human review.
- Profiles are kept in tab memory only. Refresh clears work. The workspace clears after 30 minutes or 15 minutes without interaction. Sessions also expire server-side. The UI offers deletion of profiles saved by the old version.
- CSV copy/download with formula-prefix escaping. Export requests require an active authorized session and an audit record. Copies saved outside the app remain the user's responsibility.
- Shared per-user/company/global request limits and four global processing slots. Failure of the security database blocks processing.

## Setup

1. Apply the SQL migration and configure invited accounts following [SECURITY.md](SECURITY.md).
2. Use [.env.example](.env.example) as a template for server-only settings in .env.local. Never commit keys. Keep AI disabled until company approval is recorded.
3. Install and check:

    npm ci
    npm run security:check
    npm run test:security
    npm run lint
    npm run build

4. For local development, use APP_ORIGIN=http://localhost:3000 and npm run dev. Development still requires real configured authentication; there is no silent login bypass.

The production smoke test (npm run test:smoke) launches a localhost-only server and Microsoft Edge using dummy configuration. It tests locked-down routes and the login page without sending documents to an AI provider. A managed-account end-to-end test must also be completed in the actual Supabase project before rollout.

## Main implementation files

- src/lib/security/: authentication, approval gates, bounded reads, distributed security state, safe website fetching and signed evidence.
- src/app/api/: route-level authorization and request validation.
- src/proxy.ts: per-request nonce CSP and browser security headers; not the authorization boundary.
- scripts/pdf-worker.cjs: isolated, time-bounded PDF parsing.
- supabase/migrations/: private security tables and restricted transactional RPC.
- tests/: adversarial code checks and executable database permission/retention tests.

No local source change automatically updates the live Vercel deployment. Configure and test the deployment separately before allowing confidential data.
