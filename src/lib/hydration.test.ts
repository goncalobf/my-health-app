import assert from "node:assert/strict";
import test from "node:test";
import { calculateHydrationTarget } from "./hydration";

test("computes baseline target at 37.5 ml/kg with no creatine bonus", () => {
  const result = calculateHydrationTarget({ weightKg: 80, creatineLoading: false });
  assert.equal(result.baselineLiters, 3);
  assert.equal(result.creatineBonusLiters, 0);
  assert.equal(result.targetLiters, 3);
});

test("adds the creatine-loading bonus on top of the baseline", () => {
  const result = calculateHydrationTarget({ weightKg: 80, creatineLoading: true });
  assert.equal(result.baselineLiters, 3);
  assert.equal(result.creatineBonusLiters, 1.25);
  // targetLiters is rounded to one decimal for display, so 3 + 1.25 -> 4.3.
  assert.equal(result.targetLiters, 4.3);
});

test("scales with weight", () => {
  assert.equal(calculateHydrationTarget({ weightKg: 70, creatineLoading: false }).baselineLiters, 2.6);
  assert.equal(calculateHydrationTarget({ weightKg: 100, creatineLoading: false }).baselineLiters, 3.8);
});

test("rejects a non-finite or non-positive weight", () => {
  assert.throws(() => calculateHydrationTarget({ weightKg: 0, creatineLoading: false }));
  assert.throws(() => calculateHydrationTarget({ weightKg: -5, creatineLoading: false }));
  assert.throws(() => calculateHydrationTarget({ weightKg: NaN, creatineLoading: false }));
});
