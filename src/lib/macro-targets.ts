const CUTTING_GOALS = new Set(["fat_loss", "recomposition"]);

export interface MacroTargets {
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  proteinRuleGPerKg: number;
  proteinGPerKg: number;
  fatCaloriesPct: number;
  proteinLimitedByCalories: boolean;
}

/**
 * Allocate macros after the calorie target has been established.
 * Cutting/recomposition uses the user's preferred high-protein target;
 * maintenance/gain uses a still-high resistance-training target. Fat receives
 * 25% of calories and carbohydrate receives the remainder.
 */
export function calculateMacroTargets({
  targetCalories,
  currentWeightKg,
  goal,
}: {
  targetCalories: number;
  currentWeightKg: number;
  goal: string;
}): MacroTargets {
  if (!Number.isFinite(targetCalories) || targetCalories <= 0) {
    throw new Error("A valid calorie target is required.");
  }
  if (!Number.isFinite(currentWeightKg) || currentWeightKg <= 0) {
    throw new Error("A valid current weight is required.");
  }

  const proteinRuleGPerKg = CUTTING_GOALS.has(goal) ? 2.4 : 2;
  const targetFatG = Math.round((targetCalories * 0.25) / 9);
  const requestedProteinG = Math.round(currentWeightKg * proteinRuleGPerKg);
  const maxProteinAtThisIntake = Math.max(
    0,
    Math.floor((targetCalories - targetFatG * 9) / 4)
  );
  const targetProteinG = Math.min(350, requestedProteinG, maxProteinAtThisIntake);
  const targetCarbsG = Math.max(
    0,
    Math.round(
      (targetCalories - targetProteinG * 4 - targetFatG * 9) / 4
    )
  );

  return {
    targetProteinG,
    targetCarbsG,
    targetFatG,
    proteinRuleGPerKg,
    proteinGPerKg:
      Math.round((targetProteinG / currentWeightKg) * 100) / 100,
    fatCaloriesPct:
      Math.round(((targetFatG * 9) / targetCalories) * 1000) / 10,
    proteinLimitedByCalories: targetProteinG < requestedProteinG,
  };
}
