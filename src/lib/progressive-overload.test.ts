import assert from "node:assert/strict";
import test from "node:test";
import { getProgressionRecommendation } from "./progressive-overload";

const target = {
  targetSets: 4,
  minReps: 6,
  maxReps: 8,
  weightIncrementKg: 2.5,
};

test("starts double progression at the bottom of the rep range", () => {
  const result = getProgressionRecommendation(target, []);
  assert.equal(result.action, "start");
  assert.match(result.message, /6 reps/);
});

test("adds weight only after every planned set reaches the top", () => {
  const result = getProgressionRecommendation(target, [[
    { weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 },
    { weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 },
  ]]);
  assert.equal(result.action, "increase");
  assert.equal(result.weightKg, 82.5);
});

test("keeps weight while repetitions are still progressing", () => {
  const result = getProgressionRecommendation(target, [[
    { weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 },
    { weightKg: 80, reps: 7 }, { weightKg: 80, reps: 6 },
  ]]);
  assert.equal(result.action, "repeat");
  assert.equal(result.weightKg, 80);
});

test("reduces load after missing the minimum twice without calling it a full deload", () => {
  const result = getProgressionRecommendation(target, [
    [{ weightKg: 80, reps: 5 }],
    [{ weightKg: 80, reps: 5 }],
  ]);
  assert.equal(result.action, "reduce");
  assert.equal(result.weightKg, 77.5);
  assert.match(result.reason, /not a full deload week/);
});

test("does not increase weight when top reps required a lower RIR than planned", () => {
  const result = getProgressionRecommendation(
    { ...target, targetRirMin: 1, targetRirMax: 2 },
    [[
      { weightKg: 80, reps: 8, rir: 1 }, { weightKg: 80, reps: 8, rir: 1 },
      { weightKg: 80, reps: 8, rir: 0 }, { weightKg: 80, reps: 8, rir: 1 },
    ]]
  );
  assert.equal(result.action, "repeat");
  assert.match(result.reason, /went below RIR 1/);
});

test("does not increase weight when RIR is missing on a set that hit the top", () => {
  const result = getProgressionRecommendation(
    { ...target, targetRirMin: 1, targetRirMax: 2 },
    [[
      { weightKg: 80, reps: 8, rir: 1 }, { weightKg: 80, reps: 8, rir: 1 },
      { weightKg: 80, reps: 8, rir: undefined }, { weightKg: 80, reps: 8, rir: 1 },
    ]]
  );
  assert.equal(result.action, "repeat");
  assert.notEqual(result.action, "increase");
});

test("treats RIR exactly at the target minimum as maintained", () => {
  const result = getProgressionRecommendation(
    { ...target, targetRirMin: 1, targetRirMax: 2 },
    [[
      { weightKg: 80, reps: 8, rir: 1 }, { weightKg: 80, reps: 8, rir: 1 },
      { weightKg: 80, reps: 8, rir: 1 }, { weightKg: 80, reps: 8, rir: 1 },
    ]]
  );
  assert.equal(result.action, "increase");
});

test("does not reduce after a single missed session", () => {
  const result = getProgressionRecommendation(target, [
    [{ weightKg: 80, reps: 5 }],
  ]);
  assert.notEqual(result.action, "reduce");
});

test("does not reduce when the two missed sessions were at different weights", () => {
  const result = getProgressionRecommendation(target, [
    [{ weightKg: 82.5, reps: 5 }],
    [{ weightKg: 70, reps: 5 }],
  ]);
  assert.notEqual(result.action, "reduce");
});

test("reduces when the two missed sessions were at the same weight", () => {
  const result = getProgressionRecommendation(target, [
    [{ weightKg: 80, reps: 5 }],
    [{ weightKg: 80.02, reps: 4 }],
  ]);
  assert.equal(result.action, "reduce");
});

test("recognizes rep-only progression across sessions without flagging it", () => {
  const pplTarget = { targetSets: 3, minReps: 6, maxReps: 10, weightIncrementKg: 2.5 };
  const result = getProgressionRecommendation(pplTarget, [
    [{ weightKg: 30, reps: 10 }, { weightKg: 30, reps: 10 }, { weightKg: 30, reps: 9 }],
    [{ weightKg: 30, reps: 10 }, { weightKg: 30, reps: 9 }, { weightKg: 30, reps: 8 }],
  ]);
  assert.equal(result.action, "repeat");
  assert.equal(result.weightKg, 30);
});

test("ignores a bonus set beyond the prescribed count when checking the top of the range", () => {
  const result = getProgressionRecommendation(target, [[
    { weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 },
    { weightKg: 80, reps: 8 }, { weightKg: 80, reps: 8 },
    { weightKg: 80, reps: 2 },
  ]]);
  assert.equal(result.action, "increase");
});
