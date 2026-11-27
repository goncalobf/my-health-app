import assert from "node:assert/strict";
import test from "node:test";
import { garminLoginSyncPlan, shouldSyncGarminOnLogin } from "./garmin-sync-on-login";

test("Garmin login sync is due until a sync has finished in that signed-in session", () => {
  const signedInAt = new Date("2026-11-27T09:00:00Z");
  const previousSync = new Date("2026-11-27T08:59:59Z");
  const completed = new Date("2026-11-27T09:00:05Z");
  assert.equal(shouldSyncGarminOnLogin(signedInAt, null), true);
  assert.equal(shouldSyncGarminOnLogin(signedInAt, previousSync), true);
  assert.equal(shouldSyncGarminOnLogin(signedInAt, signedInAt), false);
  assert.equal(shouldSyncGarminOnLogin(signedInAt, completed), false);
  assert.equal(shouldSyncGarminOnLogin(new Date("2026-11-27T09:03:00Z"), completed), true);
});

test("Garmin login sync requires a known, valid authentication session date", () => {
  assert.equal(shouldSyncGarminOnLogin(null, null), false);
  assert.equal(shouldSyncGarminOnLogin(new Date("invalid"), null), false);
});

test("a partial sync only retries health once the session's activities are saved", () => {
  const login = new Date("2026-11-27T09:00:00Z");
  const completed = new Date("2026-11-27T09:01:00Z");
  const partial = new Date("2026-11-27T09:02:00Z");
  assert.deepEqual(garminLoginSyncPlan(login, null, null), { activities: true, health: true });
  assert.deepEqual(garminLoginSyncPlan(login, completed, partial), { activities: false, health: true });
  assert.deepEqual(garminLoginSyncPlan(login, partial, partial), { activities: false, health: false });
  assert.deepEqual(garminLoginSyncPlan(null, completed, partial), { activities: false, health: false });
});
