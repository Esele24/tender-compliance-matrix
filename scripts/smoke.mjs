/**
 * Production smoke check for an already-built app. Start an isolated local server with
 * AI disabled and deliberately incomplete security settings, verify access/CSP protections,
 * then exercise login error rendering in headless Edge. Always close browser and server.
 */
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const port = 3197;
const base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    env: {
      ...process.env,
      APP_ORIGIN: "https://tender.example",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "test-only",
      SUPABASE_SECRET_KEY: "",
      AI_PROCESSING_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
let output = "";
server.stdout.on("data", (b) => {
  output += b;
});
server.stderr.on("data", (b) => {
  output += b;
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(base + "/login");
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(ready, "Server did not start: " + output);
  const home = await fetch(base, { redirect: "manual" });
  assert.equal(home.status, 307);
  assert.equal(home.headers.get("location"), "/login");
  const login = await fetch(base + "/login");
  const html = await login.text();
  const csp = login.headers.get("content-security-policy");
  assert.ok(csp?.includes("frame-ancestors 'none'"));
  assert.ok(!csp?.includes("'unsafe-eval'"));
  const nonce = /nonce-([^']+)/.exec(csp)?.[1];
  assert.ok(nonce);
  assert.ok(
    html.includes(`nonce="${nonce}"`),
    "Next scripts lack the response CSP nonce",
  );
  for (const route of [
    "analyse",
    "extract",
    "profile",
    "profile-docs",
    "activity",
  ]) {
    const unauth = await fetch(base + "/api/" + route, {
      method: "POST",
      headers: {
        Origin: "https://tender.example",
        "X-Tender-Request": "1",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(
      unauth.status,
      401,
      route + " must reject unauthenticated requests",
    );
    const crossSite = await fetch(base + "/api/" + route, {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(
      crossSite.status,
      403,
      route + " must reject cross-site requests",
    );
  }
  const loginBlocked = await fetch(base + "/api/auth", {
    method: "POST",
    headers: {
      Origin: "https://tender.example",
      "X-Tender-Request": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "login",
      email: "test@example.com",
      password: "not-a-real-password",
    }),
  });
  assert.equal(
    loginBlocked.status,
    503,
    "Missing security database must block login",
  );
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/login");
  await page.getByLabel("Email", { exact: true }).fill("test@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-a-real-password");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.locator('p[role="alert"]').waitFor();
  assert.ok(
    (await page.locator('p[role="alert"]').textContent()).includes("request"),
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: "security-login-check.png", fullPage: true });
  console.log(
    "Production smoke checks passed: protected routes, CSRF, fail-closed setup, CSP nonces and login rendering.",
  );
} finally {
  await browser?.close();
  server.kill();
}
