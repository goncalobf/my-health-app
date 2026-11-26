import assert from "node:assert/strict";
import test from "node:test";
import {
  isGarminToken,
  normalizeGarminActivity,
  type GarminDiToken,
} from "./garmin-data";

const token: GarminDiToken = {
  kind: "di",
  accessToken: "test-access-token-with-enough-characters",
  refreshToken: "test-refresh-token-with-enough-characters",
  clientId: "test-client",
};

test("recognizes current DI and legacy Garmin token shapes", () => {
  assert.equal(isGarminToken(token), true);
  assert.equal(isGarminToken({ oauth1: {}, oauth2: {} }), true);
  assert.equal(isGarminToken({ kind: "di", accessToken: "short" }), false);
  assert.equal(isGarminToken(null), false);
});

test("normalizes bounded Garmin activity values", () => {
  assert.deepEqual(normalizeGarminActivity({
    activityId: 42,
    activityName: "Morning run",
    activityType: { typeKey: "running" },
    duration: 1800,
    distance: 5000,
    averageHR: 999,
    calories: Number.NaN,
  }), {
    activityId: 42,
    activityName: "Morning run",
    activityType: { typeKey: "running" },
    startTimeLocal: "",
    duration: 1800,
    distance: 5000,
    elevationGain: 0,
    averageHR: 0,
    maxHR: 0,
    calories: 0,
    averageSpeed: 0,
    averagePower: 0,
    averageCadence: 0,
  });
  assert.equal(normalizeGarminActivity({ activityId: -1 }), null);
});
