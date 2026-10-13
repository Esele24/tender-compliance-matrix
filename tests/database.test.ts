/**
 * Run the real SQL migration in an in-memory PostgreSQL-compatible PGlite database.
 * Create Supabase role names, then verify permissions, rate buckets, leases, session
 * expiry, and audit retention through the same RPC interface used by the application.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// A test runs the code with known inputs and compares actual behavior to an
// expected outcome. assert.equal checks equality; assert.rejects expects an async
// failure. An in-memory test database exercises the SQL without touching live data.
// Passing checks shows these scenarios work; it does not prove every possible case.
test("Supabase security migration: permissions, atomic limits, sessions, concurrency and retention", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role;",
    );
    await db.exec(
      await readFile("supabase/migrations/202609210001_security.sql", "utf8"),
    );
    const call = async (operation: string, payload: unknown) =>
      (
        await db.query<{ result: boolean }>(
          "select public.tender_security($1,$2::jsonb) as result",
          [operation, JSON.stringify(payload)],
        )
      ).rows[0].result;
    await t.test("migration can be reapplied safely", async () => {
      await db.exec(
        await readFile("supabase/migrations/202609210001_security.sql", "utf8"),
      );
    });
    await t.test(
      "anonymous and authenticated roles cannot execute the security RPC",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await db.exec(`set role ${role}`);
          await assert.rejects(call("cleanup", {}), /permission denied/);
          await db.exec("reset role");
        }
      },
    );
    await t.test(
      "service role can use the RPC but cannot directly access private security tables",
      async () => {
        await db.exec("set role service_role");
        assert.equal(await call("cleanup", {}), true);
        await assert.rejects(
          db.query("select * from tender_security_private.audit"),
          /permission denied/,
        );
        await db.exec("reset role");
      },
    );
    await t.test(
      "rate limiter admits exactly the allowed requests and resets only expired buckets",
      async () => {
        const buckets = [{ key: "a".repeat(64), maximum: 2, seconds: 60 }];
        assert.equal(await call("limit", { buckets }), true);
        assert.equal(await call("limit", { buckets }), true);
        assert.equal(await call("limit", { buckets }), false);
        await db.exec(
          "update tender_security_private.limits set expires_at=now()-interval '1 second'",
        );
        assert.equal(await call("limit", { buckets }), true);
      },
    );
    await t.test(
      "a blocked bucket does not spend the other buckets",
      async () => {
        const buckets = [
          { key: "b".repeat(64), maximum: 1, seconds: 60 },
          { key: "c".repeat(64), maximum: 10, seconds: 60 },
        ];
        assert.equal(await call("limit", { buckets }), true);
        assert.equal(await call("limit", { buckets }), false);
        const result = await db.query<{ count: number }>(
          "select count from tender_security_private.limits where key=$1",
          ["c".repeat(64)],
        );
        assert.equal(result.rows[0].count, 1);
      },
    );
    await t.test(
      "four global processing slots; wrong release token cannot free a slot",
      async () => {
        const tokens = Array.from({ length: 4 }, () => randomUUID());
        for (const token of tokens)
          assert.equal(await call("acquire", { token }), true);
        assert.equal(await call("acquire", { token: randomUUID() }), false);
        await call("release", { token: randomUUID() });
        assert.equal(await call("acquire", { token: randomUUID() }), false);
        await call("release", { token: tokens[0] });
        assert.equal(await call("acquire", { token: randomUUID() }), true);
      },
    );
    await t.test(
      "sessions expire on inactivity, absolute age and explicit logout",
      async () => {
        const key = "d".repeat(64);
        assert.equal(await call("session_check", { key }), false);
        assert.equal(await call("session_register", { key }), true);
        assert.equal(await call("session_check", { key }), true);
        await db.exec(
          "update tender_security_private.sessions set expires_at=now()-interval '1 second'",
        );
        assert.equal(await call("session_check", { key }), false);
        await call("session_register", { key });
        await db.exec(
          "update tender_security_private.sessions set created_at=now()-interval '9 hours'",
        );
        assert.equal(await call("session_check", { key }), false);
        await call("session_register", { key });
        await call("session_revoke", { key });
        assert.equal(await call("session_check", { key }), false);
      },
    );
    await t.test(
      "audit stores only allowed fields and cleanup removes expired records",
      async () => {
        await call("audit", {
          requestId: randomUUID(),
          action: "test",
          outcome: "completed",
          document: "MUST NOT BE STORED",
          email: "not-stored@example.com",
        });
        const rows = await db.query(
          "select * from tender_security_private.audit",
        );
        assert.ok(!JSON.stringify(rows.rows).includes("MUST NOT BE STORED"));
        assert.ok(!JSON.stringify(rows.rows).includes("not-stored"));
        await db.exec(
          "update tender_security_private.audit set created_at=now()-interval '31 days'",
        );
        await call("cleanup", {});
        assert.equal(
          (
            await db.query<{ count: number }>(
              "select count(*)::int as count from tender_security_private.audit",
            )
          ).rows[0].count,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
