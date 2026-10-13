"use client";

/**
 * Two-stage sign-in screen: first email/password, then an authenticator code.
 * The server owns the session cookies. React keeps only form values and the temporary
 * MFA challenge/setup details needed to complete this sign-in.
 */
import { useState } from "react";

// Use the same request marker expected by the server origin guard; session cookies travel same-origin.
async function send(body: unknown) {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Tender-Request": "1" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Sign-in failed.");
  return result;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factor, setFactor] = useState<{
    factorId: string;
    challengeId: string;
    qr?: string;
    setupKey?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fieldBaseClass =
    "mt-2 block w-full rounded-md border border-slate-500/70 bg-slate-100/95 px-3 py-3 text-base text-slate-900 shadow-inner shadow-slate-900/5 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/40";

  // The presence of a challenge selects the MFA step. Only completed verification navigates to the workspace.
  // SIGN-IN JOURNEY: the form's onSubmit calls this function. preventDefault
  // stops the browser's normal form navigation so we can handle it with fetch.
  // First /api/auth checks email/password and returns an MFA challenge/setup.
  // Next submission sends the six-digit authenticator code. The server verifies it,
  // registers the session, and this screen navigates home; page.tsx rechecks identity.
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (factor) {
        await send({
          action: "verify",
          factorId: factor.factorId,
          challengeId: factor.challengeId,
          code,
        });
        setFactor(null);
        setCode("");
        window.location.replace("/");
      } else {
        await send({ action: "login", email, password });
        setPassword("");
        setFactor(await send({ action: "factor" }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#07161d] px-4 py-10 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(44,128,146,0.20),transparent_42%),linear-gradient(180deg,_#07161d_0%,_#040d12_100%)]" />
      <div className="relative w-full max-w-[520px]">
        <div className="rounded-[28px] border border-slate-700/70 bg-[#081c24]/90 px-7 py-8 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_24px_80px_rgba(2,8,15,0.75)] backdrop-blur-sm sm:px-10 sm:py-9">
          <h1 className="text-center text-4xl font-semibold tracking-tight text-slate-50">
            Sign in to the tender tool
          </h1>
          <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-6 text-slate-300">
            Access is limited to invited staff. Your account and authenticator are
            both required.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {!factor ? (
              <>
                <label className="block text-sm font-medium text-slate-200">
                  Email
                  <input
                    required
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${fieldBaseClass} ${
                      email ? "border-cyan-400/60" : "border-slate-500/70"
                    }`}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-200">
                  Password
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${fieldBaseClass} ${
                      password ? "border-cyan-400/60" : "border-slate-500/70"
                    }`}
                  />
                </label>
              </>
            ) : (
              <>
                {factor.qr && (
                  <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-200">
                    <p className="mb-3 text-center text-slate-300">
                      Scan this code in your authenticator app. Keep it private.
                    </p>
                    {/* An image document cannot execute SVG script in the parent page. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={factor.qr}
                      className="mx-auto rounded-lg bg-white p-3"
                      alt="Authenticator setup QR code"
                      width={240}
                      height={240}
                    />
                  </div>
                )}
                {factor.setupKey && (
                  <details className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200">
                    <summary className="cursor-pointer list-none font-medium text-slate-100">
                      Cannot scan? Enter a setup key
                    </summary>
                    <p className="mt-3 text-sm text-slate-300">
                      In your authenticator, add an account and choose manual entry.
                      Use Tender tool as the account name and select Time based if asked.
                    </p>
                    <p className="mt-4 text-sm font-semibold text-slate-100">Private setup key</p>
                    <code className="mt-2 block break-all rounded-md bg-slate-950 p-3 text-sm text-cyan-200">
                      {factor.setupKey}
                    </code>
                    <p className="mt-3 text-sm text-slate-300">
                      Enter this key only in your authenticator. Do not share it or
                      send a screenshot. Then enter the six-digit code below.
                    </p>
                  </details>
                )}
                <label className="block text-sm font-medium text-slate-200">
                  Authenticator code
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={`${fieldBaseClass} tracking-[0.6em] text-center text-lg font-medium ${
                      code ? "border-cyan-400/60" : "border-slate-500/70"
                    }`}
                  />
                </label>
              </>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                <span aria-hidden="true" className="mt-0.5 text-base">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-md border border-slate-200/80 bg-transparent px-4 py-3 text-base font-semibold text-slate-50 transition hover:border-cyan-300 hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Please wait…" : factor ? "Verify and continue" : "Continue"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm leading-6 text-slate-300">
            For an invitation, password reset, or lost authenticator, contact your
            administrator.
          </p>
        </div>
      </div>
    </main>
  );
}
