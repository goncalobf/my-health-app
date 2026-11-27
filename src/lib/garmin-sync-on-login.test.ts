import assert from "node:assert/strict";
import test from "node:test";
import { garminLoginSyncPlan } from "./garmin-sync-on-login";

const now = new Date("2026-11-27T10:00:00Z").getTime();
const before = (ms: number) => new Date(now - ms);
const full = { activities: true, health: true };
const fresh = { activities: false, health: false };

test("a new verified session triggers Garmin even after a recent successful sync", () => {
  const signedInAt = before(60_000);
  const previousSync = before(120_000);
  const completed = before(30_000);
  assert.deepEqual(garminLoginSyncPlan(signedInAt, previousSync, previousSync, { now }), full);
  assert.deepEqual(garminLoginSyncPlan(signedInAt, completed, completed, { now }), fresh);
});

test("an explicit sign-in triggers a refresh even when the authentication timestamp is reused or missing", () => {
  const previousSync = before(60_000);
  const options = { now, justSignedIn: true };
  for (const session of [before(86_400_000), null, new Date("invalid")]) {
    assert.deepEqual(garminLoginSyncPlan(session, previousSync, previousSync, options), full);
    const completed = before(2_000);
    assert.deepEqual(garminLoginSyncPlan(session, completed, completed, options), fresh);
  }
});

test("app open checks freshness even when the session date is old or unavailable", () => {
  for (const session of [before(86_400_000), null, new Date("invalid")]) {
    assert.deepEqual(garminLoginSyncPlan(session, null, null, { now }), full);
    const oldSync = before(31 * 60_000);
    assert.deepEqual(garminLoginSyncPlan(session, oldSync, oldSync, { now }), full);
    const recentSync = before(29 * 60_000);
    assert.deepEqual(garminLoginSyncPlan(session, recentSync, recentSync, { now }), fresh);
  }
});

test("a partial result from sign-in retries health without another activity pull", () => {
  const session = before(86_400_000);
  const complete = before(60_000);
  const partial = before(1_000);
  assert.deepEqual(garminLoginSyncPlan(session, complete, partial, { now }), {
    activities: false, health: true,
  });
  assert.deepEqual(garminLoginSyncPlan(session, partial, partial, { now }), fresh);
});
