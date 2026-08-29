import assert from "node:assert/strict";
import test from "node:test";
import { buildTrainingPlanStatus, findDecliningAnchors } from "./training-plan";

test("detects two consecutive repetition declines at the same anchor load", () => {
  assert.deepEqual(
    findDecliningAnchors({
      Squat: [
        { weightKg: 100, totalReps: 18 },
        { weightKg: 100, totalReps: 20 },
        { weightKg: 100, totalReps: 22 },
      ],
      PullUp: [
        { weightKg: 10, totalReps: 25 },
        { weightKg: 10, totalReps: 24 },
        { weightKg: 10, totalReps: 23 },
      ],
    }),
    ["Squat"]
  );
});

test("recommends a deload when two of three fatigue triggers are active", () => {
  const status = buildTrainingPlanStatus({
    blockStartedOn: "2026-08-01",
    today: "2026-08-29",
    isDeload: false,
    checkin: { sleepPoor: true, appetiteLow: false, jointPain: true },
    decliningAnchors: [],
  });
  assert.equal(status.week, 5);
  assert.equal(status.triggerCount, 2);
  assert.equal(status.deloadRecommended, true);
});

test("recommends a deload by week seven even without fatigue triggers", () => {
  const status = buildTrainingPlanStatus({
    blockStartedOn: "2026-07-18",
    today: "2026-08-29",
    isDeload: false,
    checkin: null,
    decliningAnchors: [],
  });
  assert.equal(status.week, 7);
  assert.equal(status.weekLimitReached, true);
  assert.equal(status.deloadRecommended, true);
});
