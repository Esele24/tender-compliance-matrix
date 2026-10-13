/**
 * Security regression tests using fictional inputs and controlled environment/fetch stubs.
 * Exercise authorization, upload limits, source verification, profile signatures, website
 * restrictions, safe errors, and provider/storage failure handling without real company data.
 */
import { csvCell } from "../src/lib/csv";
import test from "node:test";
import assert from "node:assert/strict";
import {
  readBytes,
  readJson,
  readForm,
  MAX_UPLOAD_BYTES,
} from "../src/lib/security/body";
import { origin, members, approvedForAI } from "../src/lib/security/config";
import { publicAddress, allowedWebsite } from "../src/lib/security/safe-fetch";
import {
  verifiedProfile,
  signProfile,
  verifyProfile,
  containsQuote,
} from "../src/lib/security/evidence";
import { validateMatrix } from "../src/lib/matrix";
import { checkMutation, errorResponse } from "../src/lib/security/guard";
import { generateJson } from "../src/lib/security/gemini";
import { limit, audit, processingLease } from "../src/lib/security/store";
import { pdfToText } from "../src/lib/pdf-text";
import { proxy } from "../src/proxy";
import { NextRequest } from "next/server";
import { authorizeClaims } from "../src/lib/security/claims";
import {
  saveProfile,
  profileForRequest,
  clearProfiles,
} from "../src/lib/saved-profiles";

const member = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "pegis",
  role: "analyst" as const,
};
const docs = [
  {
    name: "certificate.pdf",
    text: "The company holds ISO 9001 certification. Expiry: 30 December 2026.",
  },
];
const raw = {
  name: "Fictional Test Company",
  evidence: [
    {
      source: "certificate.pdf",
      content: "The company holds ISO 9001 certification.",
    },
  ],
};
const profile = verifiedProfile(raw, docs);
const tender = "The bidder shall provide ISO 9001 certification.";
const row = {
  requirement: tender,
  category: "Technical",
  mandatory: true,
  status: "MET",
  evidence: raw.evidence[0].content,
  evidenceSource: "certificate.pdf",
  note: "Review expiry.",
};
process.env.APP_ORIGIN = "https://tender.example";
process.env.PROFILE_SIGNING_KEY = "a".repeat(64);
process.env.WEBSITE_ALLOWED_HOSTS = "example.com";

test("authorization rejects missing invitation, missing MFA, wrong subject and expired claims", () => {
  const now = Date.now() / 1000;
  const claims = {
    sub: member.userId,
    iat: now - 1,
    exp: now + 900,
    aal: "aal2",
    session_id: "33333333-3333-4333-8333-333333333333",
  };
  process.env.ACCESS_MEMBERS = JSON.stringify([member]);
  try {
    assert.equal(
      authorizeClaims(member.userId, claims, true, now).member.tenantId,
      "pegis",
    );
    assert.throws(
      () =>
        authorizeClaims(member.userId, { ...claims, aal: "aal1" }, true, now),
      /authenticator/,
    );
    assert.doesNotThrow(() =>
      authorizeClaims(member.userId, { ...claims, aal: "aal1" }, false, now),
    );
    assert.throws(() =>
      authorizeClaims(
        "22222222-2222-4222-8222-222222222222",
        claims,
        true,
        now,
      ),
    );
    assert.throws(() =>
      authorizeClaims(member.userId, { ...claims, exp: now - 1 }, true, now),
    );
    assert.throws(() =>
      authorizeClaims(member.userId, { ...claims, iat: now + 600 }, true, now),
    );
    process.env.ACCESS_MEMBERS = JSON.stringify([
      { ...member, userId: "22222222-2222-4222-8222-222222222222" },
    ]);
    assert.throws(
      () => authorizeClaims(member.userId, claims, true, now),
      /not been invited/,
    );
  } finally {
    delete process.env.ACCESS_MEMBERS;
  }
});

test("origin configuration rejects missing, insecure, credential-bearing and path-based origins", () => {
  const previous = process.env.APP_ORIGIN;
  for (const bad of [
    "",
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com/?a=1",
  ]) {
    process.env.APP_ORIGIN = bad;
    assert.throws(origin);
  }
  process.env.APP_ORIGIN = previous;
});
test("allowlist requires unique user IDs and explicit tenant membership", () => {
  process.env.ACCESS_MEMBERS = JSON.stringify([member]);
  assert.equal(members()[0].tenantId, "pegis");
  process.env.ACCESS_MEMBERS = JSON.stringify([member, member]);
  assert.throws(members);
  process.env.ACCESS_MEMBERS = "[]";
  assert.throws(members);
  delete process.env.ACCESS_MEMBERS;
});
test("AI remains disabled unless all three approval conditions match the tenant", () => {
  process.env.AI_PROCESSING_ENABLED = "true";
  process.env.GEMINI_PAID_PROJECT_CONFIRMED = "false";
  process.env.AI_APPROVED_TENANTS = "pegis";
  assert.equal(approvedForAI("pegis"), false);
  process.env.GEMINI_PAID_PROJECT_CONFIRMED = "true";
  assert.equal(approvedForAI("pegis"), true);
  assert.equal(approvedForAI("other-company"), false);
  process.env.AI_PROCESSING_ENABLED = "false";
  assert.equal(approvedForAI("pegis"), false);
});
for (const address of [
  "127.0.0.1",
  "10.1.2.3",
  "172.16.0.1",
  "192.168.1.1",
  "169.254.169.254",
  "0.0.0.0",
  "100.64.0.1",
  "224.0.0.1",
  "255.255.255.255",
  "::1",
  "::",
  "fc00::1",
  "fe80::1",
  "::ffff:127.0.0.1",
  "2001:db8::1",
]) {
  test(`SSRF: rejects restricted IP ${address}`, () =>
    assert.equal(publicAddress(address), false));
}
test("SSRF: accepts routable public addresses", () => {
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.equal(publicAddress("2606:4700:4700::1111"), true);
});
for (const url of [
  "https://127.0.0.1",
  "https://2130706433",
  "https://0x7f000001",
  "http://example.com",
  "https://example.com.evil.test",
  "https://user:pass@example.com",
  "https://example.com:8443",
  "https://example.com/?secret=1",
  "https://[::ffff:127.0.0.1]",
]) {
  test(`SSRF: rejects unapproved destination ${url}`, () =>
    assert.throws(() => allowedWebsite(url)));
}
test("SSRF: exact approved hostname is accepted", () =>
  assert.equal(
    allowedWebsite("https://example.com/about").hostname,
    "example.com",
  ));
test("CSRF: requires configured origin and custom request header", () => {
  for (const headers of [
    {},
    { origin: "https://evil.test", "x-tender-request": "1" },
    { origin: "https://tender.example" },
    {
      origin: "https://tender.example",
      "x-tender-request": "1",
      "sec-fetch-site": "cross-site",
    },
  ])
    assert.throws(() =>
      checkMutation(
        new Request("https://tender.example/api/analyse", {
          method: "POST",
          headers: headers as Record<string, string>,
        }),
      ),
    );
  assert.doesNotThrow(() =>
    checkMutation(
      new Request("https://tender.example/api/analyse", {
        method: "POST",
        headers: { origin: "https://tender.example", "x-tender-request": "1" },
      }),
    ),
  );
});
test("streamed body limits work without Content-Length", async () => {
  const request = new Request("https://tender.example", {
    method: "POST",
    body: "a".repeat(101),
  });
  await assert.rejects(readBytes(request, 100), /too large/);
});
test("declared oversized body is rejected", async () => {
  await assert.rejects(
    readBytes(
      new Request("https://tender.example", {
        method: "POST",
        body: "x",
        headers: { "content-length": "1000" },
      }),
      10,
    ),
    /too large/,
  );
});
test("JSON rejects wrong content type and malformed data", async () => {
  await assert.rejects(
    readJson(
      new Request("https://tender.example", { method: "POST", body: "{}" }),
    ),
  );
  await assert.rejects(
    readJson(
      new Request("https://tender.example", {
        method: "POST",
        body: "{",
        headers: { "content-type": "application/json" },
      }),
    ),
  );
});
test("multipart total size includes all files", async () => {
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(MAX_UPLOAD_BYTES)]), "big.pdf");
  await assert.rejects(
    readForm(
      new Request("https://tender.example", { method: "POST", body: form }),
    ),
    /too large/,
  );
});
test("source checking accepts whitespace variation, rejects invented evidence and false citations", () => {
  assert.equal(
    containsQuote("ISO  9001\ncertification", "ISO 9001 certification"),
    true,
  );
  assert.throws(() =>
    verifiedProfile(
      {
        ...raw,
        evidence: [{ source: "certificate.pdf", content: "Holds ISO 14001." }],
      },
      docs,
    ),
  );
  assert.throws(() =>
    verifiedProfile(
      {
        ...raw,
        evidence: [{ source: "other.pdf", content: raw.evidence[0].content }],
      },
      docs,
    ),
  );
});
test("an invented company name is not presented as a verified fact", () => {
  assert.equal(verifiedProfile(raw, docs).name, "Company (name not verified)");
});
test("signed profiles reject modification, expiry and cross-account or cross-company replay", () => {
  const now = Date.now();
  const signed = signProfile(profile, member, now);
  assert.equal(verifyProfile(signed, member, now).name, profile.name);
  assert.throws(() =>
    verifyProfile({ ...signed, name: "Tampered" }, member, now),
  );
  assert.throws(() =>
    verifyProfile(signed, { ...member, tenantId: "other" }, now),
  );
  assert.throws(() =>
    verifyProfile(
      signed,
      { ...member, userId: "22222222-2222-4222-8222-222222222222" },
      now,
    ),
  );
  assert.throws(() => verifyProfile(signed, member, now + 30 * 60000));
  assert.throws(() =>
    verifyProfile({ ...signed, proof: "invalid" }, member, now),
  );
});
test("keeping a profile in this tab preserves its signed identity without sending UI metadata", () => {
  const signed = signProfile(profile, member);
  const saved = saveProfile(signed);
  const payload = profileForRequest(saved);
  assert.equal("savedAt" in payload, false);
  assert.equal(verifyProfile(payload, member).id, profile.id);
  clearProfiles();
});
test("matrix rejects invented requirements and unknown statuses", () => {
  assert.throws(() =>
    validateMatrix(
      { requirements: [{ ...row, requirement: "Invented requirement" }] },
      tender,
      profile,
    ),
  );
  assert.throws(() =>
    validateMatrix(
      { requirements: [{ ...row, status: "APPROVED" }] },
      tender,
      profile,
    ),
  );
});
test("matrix unsupported evidence becomes GAP and cannot retain false proof", () => {
  const result = validateMatrix(
    { requirements: [{ ...row, evidence: "Fake certificate" }] },
    tender,
    profile,
  );
  assert.equal(result.requirements[0].status, "GAP");
  assert.equal(result.requirements[0].evidence, "");
});
test("matrix accepts a traceable quote without claiming independent compliance verification", () =>
  assert.equal(
    validateMatrix({ requirements: [row] }, tender, profile).requirements[0]
      .status,
    "MET",
  ));
test("error responses never return upstream secrets or document text", async () => {
  const response = errorResponse(
    new Error("APIKEY=secret confidential tender body"),
    "request-1",
  );
  const text = await response.text();
  assert.ok(!text.includes("secret"));
  assert.ok(!text.includes("confidential"));
  assert.ok(text.includes("request-1"));
});
test("Gemini is never called when processing is disabled", async () => {
  process.env.AI_PROCESSING_ENABLED = "false";
  await assert.rejects(generateJson("test", {}, {}));
});
test("Gemini rejects incomplete output and does not expose provider errors", async () => {
  const original = globalThis.fetch;
  process.env.AI_PROCESSING_ENABLED = "true";
  process.env.GEMINI_PAID_PROJECT_CONFIRMED = "true";
  process.env.GEMINI_API_KEY = "test-only";
  try {
    globalThis.fetch = async () =>
      new Response("secret upstream detail", { status: 500 });
    await assert.rejects(
      generateJson("test", {}, {}),
      (e) => e instanceof Error && !e.message.includes("secret"),
    );
    globalThis.fetch = async () =>
      Response.json({ candidates: [{ finishReason: "MAX_TOKENS" }] });
    await assert.rejects(generateJson("test", {}, {}), /did not finish/);
    globalThis.fetch = async () =>
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: { parts: [{ text: '{"ok":true}' }] },
          },
        ],
      });
    assert.deepEqual(await generateJson("test", {}, {}), { ok: true });
  } finally {
    globalThis.fetch = original;
    delete process.env.GEMINI_API_KEY;
    process.env.AI_PROCESSING_ENABLED = "false";
  }
});
test("rate limiting and audit fail closed if the durable store is unavailable", async () => {
  delete process.env.SUPABASE_SECRET_KEY;
  await assert.rejects(limit([{ key: "test", maximum: 1, seconds: 60 }]));
  await assert.rejects(
    audit({ requestId: "1", action: "test", outcome: "started" }),
  );
});
test("distributed limiter rejects an exhausted bucket; concurrency releases only its own lease", async () => {
  const original = globalThis.fetch;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "test";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
  const calls: { operation: string; payload: { token?: string } }[] = [];
  try {
    globalThis.fetch = async (_url, options) => {
      calls.push(JSON.parse(options?.body as string));
      return Response.json(false);
    };
    await assert.rejects(
      limit([{ key: "user", maximum: 1, seconds: 60 }]),
      /Too many/,
    );
    globalThis.fetch = async (_url, options) => {
      calls.push(JSON.parse(options?.body as string));
      return Response.json(true);
    };
    const release = await processingLease();
    await release();
    assert.equal(calls.at(-1)?.operation, "release");
    assert.equal(calls.at(-1)?.payload.token, calls.at(-2)?.payload.token);
  } finally {
    globalThis.fetch = original;
    delete process.env.SUPABASE_SECRET_KEY;
  }
});
test("PDF rejects non-PDF bytes and corrupt PDF safely", async () => {
  await assert.rejects(pdfToText(new TextEncoder().encode("not a PDF")));
  await assert.rejects(
    pdfToText(new TextEncoder().encode("%PDF-1.7\ncorrupt")),
  );
});
test("bounded PDF worker extracts a valid text document", async () => {
  const text =
    "This is a fictional company tender document for a parser test. It contains no personal or confidential information. ".repeat(
      3,
    );
  const stream = `BT /F1 10 Tf 20 700 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => String(n).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const result = await pdfToText(new Uint8Array(Buffer.from(pdf)));
  assert.equal(result.pages, 1);
  assert.ok(result.text.includes("fictional company tender"));
});
test("security headers use fresh nonces and prohibit framing", () => {
  const first = proxy(new NextRequest("https://tender.example"));
  const second = proxy(new NextRequest("https://tender.example"));
  const csp = first.headers.get("content-security-policy")!;
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.notEqual(csp, second.headers.get("content-security-policy"));
  assert.equal(first.headers.get("cache-control"), "private, no-store");
});

test("CSV export neutralizes formulas even after leading control characters", () => {
  for (const input of ["=1+1", "+SUM(1)", "-1+2", "@SUM(1)", "\t=1+1", "\u0000=1+1", "\r\n=1+1"]) {
    assert.ok(csvCell(input).startsWith("\"'"));
  }
  assert.equal(csvCell('plain, "quoted" text'), '"plain, ""quoted"" text"');
});

test("PDF worker preserves binary bytes when bundler metadata is merged", async () => {
  const { Worker } = await import("node:worker_threads");
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const bytes = new Uint8Array(await readFile(join(process.cwd(), "sample-tenders/Renaissance_Slickline_CW67348.pdf")));
  const result = await new Promise<{ ok: boolean; text?: string; pages?: number }>((resolve, reject) => {
    const worker = new Worker(join(process.cwd(), "scripts/pdf-worker.cjs"), {
      workerData: { ...{ bytes }, __turbopack_globals__: {} },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 },
    });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("Worker timed out")); }, 10000);
    worker.once("message", value => { clearTimeout(timer); void worker.terminate(); resolve(value); });
    worker.once("error", error => { clearTimeout(timer); reject(error); });
    worker.once("exit", code => { clearTimeout(timer); reject(new Error("Worker exited: " + code)); });
  });
  assert.equal(result.ok, true);
  assert.equal(result.pages, 2);
  assert.ok((result.text?.length ?? 0) > 100);
});

test("nonconfidential evaluation is local, admin-only, explicit and separate from approval", async () => {
  const { permittedForAI, evaluationConsent } = await import("../src/lib/security/config");
  const names = ["NODE_ENV", "APP_ORIGIN", "AI_PROCESSING_ENABLED", "GEMINI_PAID_PROJECT_CONFIRMED", "AI_APPROVED_TENANTS", "AI_NONCONFIDENTIAL_EVALUATION"];
  const saved = Object.fromEntries(names.map(n => [n, process.env[n]]));
  const owner = { userId: "00000000-0000-4000-8000-000000000001", tenantId: "pegis", role: "admin" as const };
  try {
    Object.assign(process.env, {NODE_ENV:"development", APP_ORIGIN:"http://localhost:3000", AI_PROCESSING_ENABLED:"true", GEMINI_PAID_PROJECT_CONFIRMED:"true", AI_APPROVED_TENANTS:"", AI_NONCONFIDENTIAL_EVALUATION:"true"});
    assert.equal(approvedForAI("pegis"), false);
    assert.equal(permittedForAI(owner), true);
    assert.equal(permittedForAI({...owner, role:"analyst"}), false);
    assert.equal(permittedForAI({...owner, tenantId:"other"}), false);
    assert.equal(evaluationConsent(new Request("http://localhost:3000")), false);
    assert.equal(evaluationConsent(new Request("http://localhost:3000", {headers:{"X-Tender-Nonconfidential":"confirmed"}})), true);
    Object.assign(process.env, {NODE_ENV: "production"});
    assert.equal(permittedForAI(owner), false);
    Object.assign(process.env, {NODE_ENV: "development"});
    process.env.APP_ORIGIN = "https://example.com";
    assert.equal(permittedForAI(owner), false);
    process.env.APP_ORIGIN = "http://localhost:3000";
    process.env.AI_NONCONFIDENTIAL_EVALUATION = "false";
    assert.equal(permittedForAI(owner), false);
  } finally {
    for (const n of names) { if (saved[n] === undefined) delete process.env[n]; else process.env[n] = saved[n]; }
  }
});

test("matrix resolves original multiline wording and rejects invalid model references", async () => {
  const { matrixFromSourceLines } = await import("../src/lib/matrix");
  const source = "Tender heading\nMust provide ISO certification\nand proof of renewal.\nClosing date.";
  const { requirement: ignored, ...fields } = row;
  void ignored;
  const reference = { ...fields, startLine: 2, endLine: 3 };
  const result = matrixFromSourceLines({requirements:[reference]}, source, profile);
  assert.equal(result.requirements[0].requirement,"Must provide ISO certification\nand proof of renewal.");
  for (const range of [{startLine:0,endLine:3},{startLine:2,endLine:5},{startLine:3,endLine:2},{startLine:1.5,endLine:3}]) {
    assert.throws(() => matrixFromSourceLines({requirements:[{...reference,...range}]},source,profile));
  }
  assert.throws(() => matrixFromSourceLines({requirements:[{...reference, requirement:"Invented"}]},source,profile));
});
