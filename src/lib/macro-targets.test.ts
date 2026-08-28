import assert from "node:assert/strict";
import test from "node:test";
import { calculateMacroTargets } from "./macro-targets";

test("a cut allocates 2.4 grams of protein per kilogram", () => {
  const result = calculateMacroTargets({
    targetCalories: 2200,
    currentWeightKg: 80,
    goal: "fat_loss",
  });

  assert.equal(result.targetProteinG, 192);
  assert.equal(result.proteinGPerKg, 2.4);
  assert.equal(result.targetFatG, 61);
  assert.equal(result.targetCarbsG, 221);
  assert.equal(result.proteinLimitedByCalories, false);
});

test("recomposition uses the same high-protein cutting rule", () => {
  const result = calculateMacroTargets({
    targetCalories: 2000,
    currentWeightKg: 75,
    goal: "recomposition",
  });

  assert.equal(result.targetProteinG, 180);
  assert.equal(result.proteinRuleGPerKg, 2.4);
});

test("maintenance and muscle gain use 2 grams per kilogram", () => {
  for (const goal of ["maintenance", "muscle_gain"]) {
    const result = calculateMacroTargets({
      targetCalories: 2500,
      currentWeightKg: 80,
      goal,
    });
    assert.equal(result.targetProteinG, 160);
    assert.equal(result.proteinRuleGPerKg, 2);
  }
});

test("protein is reduced when the calorie target cannot contain the requested macros", () => {
  const result = calculateMacroTargets({
    targetCalories: 1200,
    currentWeightKg: 150,
    goal: "fat_loss",
  });

  assert.equal(result.proteinLimitedByCalories, true);
  assert.ok(result.targetCarbsG <= 1);
  const macroCalories =
    result.targetProteinG * 4 +
    result.targetCarbsG * 4 +
    result.targetFatG * 9;
  assert.ok(Math.abs(macroCalories - 1200) <= 4);
});
