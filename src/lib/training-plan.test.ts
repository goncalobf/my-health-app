import assert from "node:assert/strict";
import test from "node:test";
import { buildTrainingPlanStatus, findDecliningAnchors } from "./training-plan";

test("detects two consecutive repetition declines at the same anchor load", () => {
  assert.deepEqual(
    findDecliningAnchors({
      Squat: [
        { weightKg: 100, setCount: 3, totalReps: 18 },
        { weightKg: 100, setCount: 3, totalReps: 20 },
        { weightKg: 100, setCount: 3, totalReps: 22 },
      ],
      PullUp: [
        { weightKg: 10, setCount: 3, totalReps: 25 },
        { weightKg: 10, setCount: 3, totalReps: 24 },
        { weightKg: 10, setCount: 3, totalReps: 23 },
      ],
    }),
    ["Squat"],
  );
});

test("recommends a deload when two of three fatigue triggers are active", () => {
  const status = buildTrainingPlanStatus({
    blockStartedOn: "2026-08-01",
    today: "2026-08-29",
    isDeload: false,
    checkin: { sleepPoor: true, appetiteLow: false, jointPain: true },
    recentCheckins: Array(2).fill({
      sleepPoor: true,
      appetiteLow: false,
      jointPain: true,
    }),
    decliningAnchors: [],
  });
  assert.equal(status.week, 5);
  assert.equal(status.triggerCount, 2);
  assert.equal(status.deloadRecommended, true);
});

test("prompts a review at week seven without requiring a deload", () => {
  const status = buildTrainingPlanStatus({
    blockStartedOn: "2026-07-18",
    today: "2026-08-29",
    isDeload: false,
    checkin: null,
    decliningAnchors: [],
  });
  assert.equal(status.week, 7);
  assert.equal(status.weekLimitReached, true);
  assert.equal(status.deloadRecommended, false);
  assert.equal(status.reviewDue, true);
});

test("fewer sets are not mistaken for declining performance", () => {
  assert.deepEqual(
    findDecliningAnchors({
      Squat: [
        { weightKg: 80, totalReps: 20, setCount: 2 },
        { weightKg: 80, totalReps: 30, setCount: 3 },
        { weightKg: 80, totalReps: 40, setCount: 4 },
      ],
    }),
    [],
  );
});
test("a single poor check-in does not establish sustained fatigue", () => {
  const checkin = { sleepPoor: true, appetiteLow: false, jointPain: true };
  assert.equal(
    buildTrainingPlanStatus({
      blockStartedOn: "2026-01-01",
      today: "2026-02-20",
      isDeload: false,
      checkin,
      recentCheckins: [checkin],
      decliningAnchors: [],
    }).deloadRecommended,
    false,
  );
});
