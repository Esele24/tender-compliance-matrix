# Tender tool security and activation guide

Status: security changes implemented locally. Production activation and real-account acceptance testing require the owner's Supabase setup. No claim of 100% security or certification is made.

## Approved scope

- One company: Pegis. Only Esele and specifically invited Pegis staff.
- Gemini billing is enabled according to Esele. The exact deployed API key/project must still be checked.
- Pegis permission to send confidential information to Gemini is pending. Leave `AI_PROCESSING_ENABLED=false` and `AI_APPROVED_TENANTS` empty.
- The application remains locked if authentication configuration is missing. Login/processing fail closed when the security database is unavailable.

## Data flow and retention

1. Browser uploads travel to the application host over HTTPS. The application extracts PDF text in a worker with a 10-second timeout, heap limits, 200-page limit and 200,000-character limit. These limits reduce parser resource abuse; a worker is not an operating-system sandbox.
2. Building profiles and matrices sends extracted text to Google's Gemini API only when the server-side approval gate permits it. The gate is administrative policy, not proof that a contract exists.
3. There is no application document database or file bucket. Profiles, tender text and matrices are held in memory, not browser persistent storage. The workspace clears after 30 minutes or 15 minutes without interaction. Signed profiles expire after 30 minutes. Refreshing loses current work. Garbage collection does not guarantee forensic erasure.
4. Supabase holds account credentials/factors and minimal security records. It does not receive tender contents through these security functions. Sessions expire after 15 minutes without a validated server request and after 8 hours absolutely. Logout revokes the application session before signing out of Supabase.
5. Audit records contain request IDs, action/outcome, user UUID, tenant ID and timestamps. No document names, prompts, API keys, passwords, email addresses or document text are written to the audit table. Authentication failures before identifying a user are not attributed to a person. Export events mean an export was requested, not proof of where a file was ultimately saved.
6. Audit rows older than 30 days are purged on security calls (up to 1,000 per call). Configure the scheduled cleanup below so retention does not depend on traffic. Provider backups have their own retention; agree those separately.
7. Exported files, copied text and provider-side operational/safety logs are outside this application's deletion controls. Provider data handling must be approved before confidential use. Analytics was removed.

## Configure your Supabase project

Use a dedicated project for this tool where possible. If reusing an existing project, review its users, database permissions, auth settings and other applications first: project-wide authentication settings can affect them.

1. In the Supabase SQL editor, run `supabase/migrations/202609210001_security.sql`. It creates a private schema and one RPC, not document tables. Anonymous and authenticated roles have no execution rights on the RPC; only the server secret's service role can call it. Direct access to its private tables is denied to that role too. The function uses a fixed empty search path and explicit table references.
2. Disable public signups and unused auth providers. Enable TOTP MFA. Configure strong passwords, leaked-password protection where available, and provider-side authentication limits. Set the auth JWT lifetime to 15 minutes. Protect Supabase, hosting and Google administrator accounts with MFA as well.
3. Create the explicitly authorized users through your administrator workflow and arrange their initial password securely. This version uses email/password plus authenticator codes; it does not implement invitation-link or password-reset-link callbacks. Account recovery is an administrator process with identity verification. Never share a single staff account or put passwords in chat.
4. Copy each actual user UUID into `ACCESS_MEMBERS`, for example:

   ```json
   [{"userId":"ACTUAL-UUID-FROM-SUPABASE","tenantId":"pegis","role":"admin"}]
   ```

   Use `analyst` for other staff. These roles label membership; both can use the tender workflow. There is no application account-management screen. Account management remains in the secured provider dashboard. Mixed company memberships are rejected.
5. Put the Supabase URL, publishable key and server-only secret key in `.env.local` for local use and the host's secret environment settings for deployment. Never commit `.env.local`, put secrets in `NEXT_PUBLIC_*`, or send them in a message. The runtime needs the server secret to call the restricted security RPC. Rotate it if exposed.
6. Set `APP_ORIGIN` to the exact deployed HTTPS origin. Preview deployments need their own exact origin and isolated configuration. Local development permits `http://localhost:3000`; production does not permit HTTP.
7. Set `PROFILE_SIGNING_KEY` to 32 or more cryptographically random bytes encoded as hex. Rotating it invalidates all existing profiles. The local initialization script creates a key without printing it.
8. Run `npm run security:check`, then `npm run security:check -- --live`. The first validates settings; the second checks connectivity and access to the installed security RPC using a deliberately invalid request that rolls back without committing changes. Neither prints secrets or replaces real-account authentication testing. If the hostname does not resolve, verify `SUPABASE_URL` against the project dashboard and restore the project if paused. Restart the development server after changing `.env.local`.

No Redis account is required. Limits and processing slots are enforced in database transactions, shared across all app instances.

## Retention schedule

After enabling Supabase Cron (`pg_cron`) for the project, schedule this command from the secured SQL editor:

```sql
select cron.schedule(
  'tender-security-cleanup',
  '0 * * * *',
  $$select public.tender_security('cleanup', '{}'::jsonb);$$
);
```

Do not schedule duplicate jobs. Monitor job failures. Database owners can inspect audit records in the private schema. The application RPC has no audit edit/read operation; database owners and provider administrators can still alter records. If tamper-resistant retention is required, export to a separately controlled append-only logging system. Set alerts for repeated failures, quota exhaustion and provider outages; the code alone cannot configure a monitored operations team.

## Before enabling confidential AI processing

- Record Pegis approval of the actual application host, Google processing, Supabase account/security metadata, data locations, retention, and who administers each service.
- Verify that the deployed Gemini key belongs to the billing-enabled project. Paid-service handling is not zero retention: see https://ai.google.dev/gemini-api/terms.
- Only after approval, set `AI_PROCESSING_ENABLED=true`, `GEMINI_PAID_PROJECT_CONFIRMED=true`, and `AI_APPROVED_TENANTS=pegis` in the deployment environment. All three conditions are required. Without approval, keep the current disabled values.
- For website profiles, set `WEBSITE_ALLOWED_HOSTS` to specifically approved exact hostnames. Requests are HTTPS-only, DNS addresses must be public and are pinned for the connection, redirects and compressed responses are rejected, and response size/time are bounded. Only the supplied page is fetched.
- Validate source documents and human review procedures. Quotes are checked against supplied text, not a certification registry. Prompt separation and quote checks reduce manipulation; they cannot guarantee complete extraction or correct compliance judgments.

## Acceptance tests before rollout

Automated commands:

```text
npm ci
npm run test:security
npm run lint
npm run typecheck
npm run build
npm run test:smoke
npm audit
```

The smoke test uses a local production server and Microsoft Edge, dummy configuration, and no Gemini requests. Database tests run the actual migration in PGlite; hosted Postgres permissions, managed Auth, email delivery and deployment configuration still need verification in the real project.

With actual invited test accounts, verify password + TOTP enrollment/sign-in, wrong codes, an uninvited account, logout/replayed cookies, removal from the allowlist, idle expiry, source-profile tampering and expiry, rate limits, and security-store outage behavior. Test one nonconfidential PDF and one approved public website. Confirm API responses and pages use HTTPS, no-store, nonce-based CSP and secure HttpOnly SameSite cookies. Check request logs do not collect uploaded bodies. Check worker files are included in the deployment artifact. Restore a security-database backup in an isolated test project and verify permissions remain restricted.

The local tests cannot replace independent penetration testing of the deployed system. Large network attacks require hosting-level firewall/DDoS controls; request-body limits inside the application do not replace edge limits. Confirm host body/time limits support the 3 MB upload cap and up to 180 seconds for multi-document processing.

## Revocation and incidents

Remove a user's UUID from `ACCESS_MEMBERS` and redeploy/restart to revoke authorization immediately on the next check. Also disable the account and revoke sessions in Supabase. If a credential or document may have leaked: set `AI_PROCESSING_ENABLED=false`, restrict deployment access, preserve minimal audit evidence, rotate the affected credentials, and involve Pegis IT. Do not paste leaked documents or keys into logs or support messages. Keep patched dependencies and run the security suite before updates are released.

No production deployment or cloud account changes are performed merely by editing these local files.

## Local evaluation authorized by owner

The owner explicitly confirmed that evaluation submissions contain no confidential documents. Local development now permits the admin account to use Gemini after confirming each submission is nonconfidential. This is user attestation, not automatic content classification. Company approval remains pending and AI_APPROVED_TENANTS remains empty. The evaluation exception is disabled outside development and outside http://localhost:3000. Billing status is based on the owner’s confirmation. No document was sent automatically by this configuration change.

Local admin evaluation uses disclosed authorization on the processing action instead of checkboxes, as explicitly requested by the owner. Outside local evaluation, both UI confirmations and the server-side reviewed requirement remain. No review attestation is fabricated for evaluation submissions.
