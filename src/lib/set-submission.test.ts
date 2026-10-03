import assert from "node:assert/strict";
import test from "node:test";
import { sameSetSubmission } from "./set-submission";
const submission = {
  exerciseId: 1,
  setNumber: 2,
  weightKg: 1.2,
  reps: 10,
  rir: null,
  isWarmup: false,
  isDropSet: false,
  completed: true,
};
const saved = { ...submission, completedAt: new Date("2026-01-01") };
test("a retried set tolerates PostgreSQL real rounding but preserves observations", () => {
  assert.equal(
    sameSetSubmission({ ...saved, weightKg: 1.2000000476837158 }, submission),
    true,
  );
  for (const change of [
    { exerciseId: 2 },
    { setNumber: 3 },
    { weightKg: 1.21 },
    { reps: 11 },
    { rir: 0 },
    { isWarmup: true },
    { isDropSet: true },
    { completed: false },
  ])
    assert.equal(sameSetSubmission(saved, { ...submission, ...change }), false);
});
test("a retry distinguishes an incomplete draft from a logged set", () => {
  assert.equal(
    sameSetSubmission(
      { ...saved, completedAt: null },
      { ...submission, completed: false },
    ),
    true,
  );
  assert.equal(
    sameSetSubmission({ ...saved, completedAt: null }, submission),
    false,
  );
});
