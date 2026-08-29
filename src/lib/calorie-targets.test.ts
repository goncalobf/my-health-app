import assert from "node:assert/strict";
import test from "node:test";
import {
  basalMetabolicRate,
  estimateCalorieTarget,
  WEEKLY_CHANGE_PCT,
} from "./calorie-targets";

const profile = {
  currentWeightKg: 80,
  heightCm: 180,
  ageYears: 30,
  biologicalSex: "male" as const,
};

test("uses Mifflin-St Jeor for each stated sex", () => {
  // 10*80 + 6.25*180 - 5*30 = 1775
  assert.equal(basalMetabolicRate(profile), 1780);
  assert.equal(
    basalMetabolicRate({ ...profile, biologicalSex: "female" }),
    1614
  );
});

test("an unstated sex sits between the two formulas", () => {
  const male = basalMetabolicRate(profile);
  const female = basalMetabolicRate({ ...profile, biologicalSex: "female" });
  const unspecified = basalMetabolicRate({
    ...profile,
    biologicalSex: "unspecified",
  });
  assert.ok(unspecified < male && unspecified > female);
});

test("maintenance holds calories and fat loss cuts them", () => {
  const maintain = estimateCalorieTarget({ ...profile, goal: "maintenance" });
  assert.equal(maintain.targetCalories, maintain.maintenanceCalories);

  const cut = estimateCalorieTarget({ ...profile, goal: "fat_loss" });
  assert.ok(cut.targetCalories < maintain.targetCalories);

  const gain = estimateCalorieTarget({ ...profile, goal: "muscle_gain" });
  assert.ok(gain.targetCalories > maintain.targetCalories);
});

test("recomposition cuts more gently than fat loss", () => {
  const cut = estimateCalorieTarget({ ...profile, goal: "fat_loss" });
  const recomp = estimateCalorieTarget({ ...profile, goal: "recomposition" });
  assert.ok(recomp.targetCalories > cut.targetCalories);
  assert.equal(WEEKLY_CHANGE_PCT.recomposition, -0.25);
});

test("never prescribes a deficit steeper than a quarter of maintenance", () => {
  const heavy = estimateCalorieTarget({
    ...profile,
    currentWeightKg: 200,
    goal: "fat_loss",
  });
  assert.ok(heavy.targetCalories >= heavy.maintenanceCalories * 0.75);
  assert.equal(heavy.floored, true);
});

test("never prescribes below the absolute floor", () => {
  const small = estimateCalorieTarget({
    currentWeightKg: 40,
    heightCm: 150,
    ageYears: 70,
    biologicalSex: "female",
    goal: "fat_loss",
  });
  assert.ok(small.targetCalories >= 1200);
});

test("rejects a profile it cannot compute from", () => {
  assert.throws(() =>
    estimateCalorieTarget({ ...profile, currentWeightKg: 0, goal: "fat_loss" })
  );
  assert.throws(() =>
    estimateCalorieTarget({ ...profile, ageYears: -1, goal: "fat_loss" })
  );
});

test("returns whole numbers fit for storing as targets", () => {
  const estimate = estimateCalorieTarget({ ...profile, goal: "recomposition" });
  for (const value of [estimate.bmr, estimate.maintenanceCalories, estimate.targetCalories]) {
    assert.equal(Number.isInteger(value), true);
  }
});
