import assert from "node:assert/strict";
import test from "node:test";
import {
  createSet,
  setPatch,
  validPrescription,
  defaultPrescription,
  sessionPatch,
} from "./training-validation";
const valid = { exerciseId: 1, setNumber: 1, weightKg: 0, reps: 10 };
test("set validation preserves genuine zero external load and unknown effort", () => {
  const parsed = createSet.parse(valid);
  assert.equal(parsed.weightKg, 0);
  assert.equal(parsed.rir, null);
  assert.equal(
    createSet.parse({ ...valid, weightKg: "81,25" }).weightKg,
    81.25,
  );
});
test("set endpoints reject missing, negative, nonfinite and fabricated observations", () => {
  for (const patch of [
    { weightKg: null },
    { weightKg: "" },
    { weightKg: false },
    { weightKg: -1 },
    { weightKg: Infinity },
    { reps: 0 },
    { reps: -1 },
    { reps: 1.5 },
    { rir: 11 },
    { rir: -1 },
    { isDropSet: true, isWarmup: true },
  ])
    assert.equal(createSet.safeParse({ ...valid, ...patch }).success, false);
  assert.equal(
    createSet.safeParse({ exerciseId: 1, setNumber: 1 }).success,
    false,
  );
  assert.equal(setPatch.safeParse({ reps: 0 }).success, false);
});
test("prescription validation rejects invalid ranges and conflicting muscle counts", () => {
  for (const patch of [
    { targetSets: -1 },
    { weightIncrementKg: 0 },
    { minReps: 15, maxReps: 10 },
    { targetRirMin: 2, targetRirMax: 1 },
    { targetRirMin: 1, targetRirMax: null },
    { avoidFailure: true, targetRirMin: 0, targetRirMax: 1 },
    { muscleProfile: { direct: ["Chest"], indirect: ["Chest"] } },
  ])
    assert.equal(
      validPrescription.safeParse({ ...defaultPrescription, ...patch }).success,
      false,
    );
});
test("session API cannot accept client-supplied history snapshots or ownership", () => {
  assert.equal(
    sessionPatch.safeParse({ prescriptionSnapshot: {} }).success,
    false,
  );
  assert.equal(sessionPatch.safeParse({ userId: 2 }).success, false);
  assert.equal(
    sessionPatch.safeParse({ performanceContext: "invented" }).success,
    false,
  );
});
