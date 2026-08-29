import assert from "node:assert/strict";
import test from "node:test";
import { prefillSet, suggestDropWeight } from "./set-prefill";

const target = {
  minReps: 6,
  maxReps: 8,
  recommendedWeightKg: 82.5,
  recommendationAction: "increase" as const,
};

test("opens an added-load set at the bottom of the rep range", () => {
  const result = prefillSet(target, { weightKg: 80, reps: 8 });
  assert.deepEqual(result, { weightKg: 82.5, reps: 6 });
});

test("opens a held-load set at last session's reps so they can be beaten", () => {
  const result = prefillSet(
    { ...target, recommendedWeightKg: 80, recommendationAction: "repeat" },
    { weightKg: 80, reps: 7 }
  );
  assert.deepEqual(result, { weightKg: 80, reps: 7 });
});

test("falls back to last session, then to the previous set of this session", () => {
  const noRecommendation = {
    ...target,
    recommendedWeightKg: null,
    recommendationAction: null,
  };
  assert.equal(prefillSet(noRecommendation, { weightKg: 70, reps: 8 }).weightKg, 70);
  assert.equal(
    prefillSet(noRecommendation, null, { weightKg: 65, reps: 8 }).weightKg,
    65
  );
});

test("never prefills a zeroed set when a rep range is missing", () => {
  const adHoc = {
    minReps: 0,
    maxReps: 0,
    recommendedWeightKg: null,
    recommendationAction: null,
  };
  const result = prefillSet(adHoc, { weightKg: 40, reps: 12 });
  assert.deepEqual(result, { weightKg: 40, reps: 12 });
});

test("returns zeroes only when there is nothing at all to go on", () => {
  const empty = {
    minReps: 0,
    maxReps: 0,
    recommendedWeightKg: null,
    recommendationAction: null,
  };
  assert.deepEqual(prefillSet(empty), { weightKg: 0, reps: 0 });
});

test("suggests a drop near 80% snapped to the exercise increment", () => {
  assert.equal(suggestDropWeight(60, 2.5), 47.5);
  assert.equal(suggestDropWeight(100, 5), 80);
});

test("keeps a drop at least one increment below the effort it follows", () => {
  assert.equal(suggestDropWeight(10, 5), 5);
  assert.equal(suggestDropWeight(2.5, 2.5), 0);
});

test("treats a bodyweight exercise as having nothing to strip", () => {
  assert.equal(suggestDropWeight(0, 2.5), 0);
});
