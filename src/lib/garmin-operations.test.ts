import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { Client } from "pg";
import { garminOperationState } from "@/db/schema";
import type { GarminDiToken } from "./garmin-data";

const database = process.env.GARMIN_TEST_DATABASE_URL;
const token: GarminDiToken = {
  kind: "di",
  accessToken: "garmin-integration-access-fixture",
  refreshToken: "garmin-integration-refresh-fixture",
  clientId: "garmin-integration-client-fixture",
};

test("serializes Garmin handshakes and prevents renewals from replacing another connection", {
  skip: !database,
}, async () => {
  assert.ok(database);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname));
  process.env.DATABASE_URL = database;
  process.env.GARMIN_ENCRYPTION_KEY = "42".repeat(32);
  const alias = pathToFileURL(require.resolve("next/dist/compiled/server-only/empty.js")).href;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return specifier === "server-only" ? { url: alias, shortCircuit: true } : next(specifier, context);
    },
  });
  const [auth, operations, crypto] = await Promise.all([
    import("./garmin-auth-session"), import("./garmin-operations"), import("./garmin-crypto"),
  ]).finally(() => hooks.deregister());
  const { beginGarminAuth, claimGarminAuth, settleGarminAuth, completeGarminAuthSession, cancelGarminAuth } = auth;
  const { withGarminAccount, withGarminSync, GarminSyncSuperseded, disconnectGarmin } = operations;
  const db = new Client({ connectionString: database });
  await db.connect();
  const owners: number[] = [];
  try {
    for (let i = 0; i < 2; i++) {
      const email = `${randomUUID()}@garmin-fixture.test`;
      const { rows } = await db.query("INSERT INTO app_users (email) VALUES ($1) RETURNING id", [email]);
      owners.push(rows[0].id);
    }
    const [userId, otherId] = owners;
    const first = await beginGarminAuth(userId, "browser");
    assert.ok(first);
    const owner = { userId, purpose: "browser" as const, sessionId: first.id, secret: first.secret };
    assert.deepEqual(await claimGarminAuth(otherId, { ...owner, action: "start" }), { status: "stale" });

    const starts = await Promise.all([
      claimGarminAuth(userId, { ...owner, action: "start" }),
      claimGarminAuth(userId, { ...owner, action: "start" }),
    ]);
    const start = starts.find((attempt) => attempt.status === "claimed");
    assert.ok(start);
    assert.equal(starts.filter((attempt) => attempt.status === "claimed").length, 1);
    assert.equal(await completeGarminAuthSession({ ...owner, purpose: "legacy" }, token, start.attemptId), false);
    assert.equal(await settleGarminAuth(owner, start.attemptId, "first-challenge"), true);

    const resume = await claimGarminAuth(userId, { ...owner, action: "resume", state: "first-challenge" });
    assert.equal(resume.status, "claimed");
    assert.equal(await settleGarminAuth(owner, resume.attemptId, "replacement-challenge"), true);
    assert.deepEqual(await claimGarminAuth(userId, { ...owner, action: "resume", state: "first-challenge" }), { status: "stale" });
    const replacement = await claimGarminAuth(userId, { ...owner, action: "resume", state: "replacement-challenge" });
    assert.equal(replacement.status, "claimed");
    const newer = await beginGarminAuth(userId, "browser");
    assert.ok(newer);
    assert.equal(await completeGarminAuthSession(owner, token, replacement.attemptId), false);
    await cancelGarminAuth(otherId, newer.id);
    const newestOwner = { ...owner, sessionId: newer.id, secret: newer.secret };
    const newestStart = await claimGarminAuth(userId, { ...newestOwner, action: "start" });
    assert.equal(newestStart.status, "claimed");

    const lease = randomUUID();
    await withGarminAccount(userId, async (tx) => {
      await tx.update(garminOperationState).set({ syncLease: lease, syncExpiresAt: new Date(Date.now() + 10_000) })
        .where(eq(garminOperationState.userId, userId));
    });
    const finish = () => completeGarminAuthSession(newestOwner, token, newestStart.attemptId);
    assert.deepEqual((await Promise.all([finish(), finish()])).sort(), [false, true]);
    await assert.rejects(withGarminSync(userId, lease, async () => assert.fail("Stale sync ran")), GarminSyncSuperseded);
    const { rows } = await db.query("SELECT user_id, encrypted_data FROM garmin_connections WHERE user_id = ANY($1)", [owners]);
    assert.deepEqual(rows.map((row) => row.user_id), [userId]);
    assert.deepEqual(JSON.parse(crypto.decrypt(rows[0].encrypted_data)), token);

    const pending = await beginGarminAuth(userId, "browser");
    assert.ok(pending);
    await disconnectGarmin(userId);
    assert.deepEqual(await claimGarminAuth(userId, { sessionId: pending.id, secret: pending.secret, action: "start" }), { status: "stale" });
    assert.equal((await db.query("SELECT 1 FROM garmin_connections WHERE user_id = $1", [userId])).rowCount, 0);

    const limited = await Promise.all(Array.from({ length: 12 }, () => beginGarminAuth(otherId, "legacy")));
    assert.equal(limited.filter(Boolean).length, 10);
    const persisted = await db.query("SELECT id, secret FROM garmin_auth_sessions WHERE user_id = $1 AND status = 'pending'", [otherId]);
    assert.equal(persisted.rowCount, 1);
    const last = limited.find((session) => session?.id === persisted.rows[0].id);
    assert.ok(last);
    assert.notEqual(persisted.rows[0].secret, last.secret);
    const legacyOwner = { userId: otherId, purpose: "legacy" as const, sessionId: last.id, secret: last.secret };
    const legacyToken = {
      oauth1: { oauth_token: "old-fixture-oauth1", oauth_token_secret: "old-fixture-secret" },
      oauth2: { access_token: "old-fixture-oauth2" },
    };
    assert.equal(await completeGarminAuthSession(legacyOwner, legacyToken), true);
    assert.equal(await completeGarminAuthSession(legacyOwner, legacyToken), false);
  } finally {
    await db.query("DELETE FROM app_users WHERE id = ANY($1)", [owners]);
    await db.end();
  }
});
