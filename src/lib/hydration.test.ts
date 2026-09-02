import assert from "node:assert/strict";
import test from "node:test";
import { calculateHydrationTarget } from "./hydration";

test("computes baseline target at 37.5 ml/kg with no creatine bonus", () => {
  const result = calculateHydrationTarget({ weightKg: 80, creatinePhase: "none" });
  assert.equal(result.baselineLiters, 3);
  assert.equal(result.creatineBonusLiters, 0);
  assert.equal(result.targetLiters, 3);
});

test("adds the loading-phase bonus on top of the baseline", () => {
  const result = calculateHydrationTarget({ weightKg: 80, creatinePhase: "loading" });
  assert.equal(result.baselineLiters, 3);
  assert.equal(result.creatineBonusLiters, 1.25);
  // targetLiters is rounded to one decimal for display, so 3 + 1.25 -> 4.3.
  assert.equal(result.targetLiters, 4.3);
});

test("maintenance phase adds no bonus — baseline already covers it", () => {
  const result = calculateHydrationTarget({ weightKg: 80, creatinePhase: "maintenance" });
  assert.equal(result.baselineLiters, 3);
  assert.equal(result.creatineBonusLiters, 0);
  assert.equal(result.targetLiters, 3);
});

test("scales with weight", () => {
  assert.equal(calculateHydrationTarget({ weightKg: 70, creatinePhase: "none" }).baselineLiters, 2.6);
  assert.equal(calculateHydrationTarget({ weightKg: 100, creatinePhase: "none" }).baselineLiters, 3.8);
});

test("rejects a non-finite or non-positive weight", () => {
  assert.throws(() => calculateHydrationTarget({ weightKg: 0, creatinePhase: "none" }));
  assert.throws(() => calculateHydrationTarget({ weightKg: -5, creatinePhase: "none" }));
  assert.throws(() => calculateHydrationTarget({ weightKg: NaN, creatinePhase: "none" }));
});
