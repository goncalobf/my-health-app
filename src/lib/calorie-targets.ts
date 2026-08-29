/**
 * Deterministic starting calorie target for a new account.
 *
 * Onboarding has no training or weigh-in history to learn from, so this is an
 * estimate, not a measurement: Mifflin-St Jeor for resting energy, a single
 * activity multiplier, then an adjustment sized by the goal. Adaptive targets
 * and the coach refine it once real data exists.
 */

export type BiologicalSex = "male" | "female" | "unspecified";

export type Goal = "fat_loss" | "recomposition" | "maintenance" | "muscle_gain";

export interface CalorieEstimateInput {
  currentWeightKg: number;
  heightCm: number;
  ageYears: number;
  biologicalSex: BiologicalSex;
  goal: Goal;
}

export interface CalorieEstimate {
  bmr: number;
  maintenanceCalories: number;
  targetCalories: number;
  targetWeeklyChangePct: number;
  /** True when a safety floor stopped the deficit going lower. */
  floored: boolean;
}

/**
 * Someone who logs resistance training several times a week. Deliberately
 * conservative: overestimating maintenance makes a cut stall silently.
 */
const ACTIVITY_MULTIPLIER = 1.45;

/** Energy in a kilogram of body mass, used to size the daily adjustment. */
const KCAL_PER_KG = 7700;

/** Percent of bodyweight per week each goal aims to change. */
export const WEEKLY_CHANGE_PCT: Record<Goal, number> = {
  fat_loss: -0.5,
  recomposition: -0.25,
  maintenance: 0,
  muscle_gain: 0.25,
};

/** Never prescribe below this, whatever the arithmetic says. */
const ABSOLUTE_FLOOR_KCAL = 1200;
/** Nor a deficit steeper than this share of maintenance. */
const MAX_DEFICIT_FRACTION = 0.25;
const MAX_SURPLUS_FRACTION = 0.2;

export function basalMetabolicRate({
  currentWeightKg,
  heightCm,
  ageYears,
  biologicalSex,
}: Omit<CalorieEstimateInput, "goal">): number {
  const shared = 10 * currentWeightKg + 6.25 * heightCm - 5 * ageYears;
  if (biologicalSex === "male") return shared + 5;
  if (biologicalSex === "female") return shared - 161;
  // Without a stated sex, sit between the two rather than assume either.
  return shared - 78;
}

export function estimateCalorieTarget(
  input: CalorieEstimateInput
): CalorieEstimate {
  const { currentWeightKg, heightCm, ageYears, goal } = input;
  if (
    !Number.isFinite(currentWeightKg) ||
    currentWeightKg <= 0 ||
    !Number.isFinite(heightCm) ||
    heightCm <= 0 ||
    !Number.isFinite(ageYears) ||
    ageYears <= 0
  ) {
    throw new Error("Weight, height and age are required to estimate calories.");
  }

  const bmr = Math.round(basalMetabolicRate(input));
  const maintenanceCalories = Math.round(bmr * ACTIVITY_MULTIPLIER);
  const targetWeeklyChangePct = WEEKLY_CHANGE_PCT[goal] ?? 0;

  const weeklyKgChange = (targetWeeklyChangePct / 100) * currentWeightKg;
  const rawTarget =
    maintenanceCalories + (weeklyKgChange * KCAL_PER_KG) / 7;

  const lowerBound = Math.max(
    ABSOLUTE_FLOOR_KCAL,
    Math.round(maintenanceCalories * (1 - MAX_DEFICIT_FRACTION))
  );
  const upperBound = Math.round(maintenanceCalories * (1 + MAX_SURPLUS_FRACTION));
  const targetCalories = Math.round(
    Math.min(upperBound, Math.max(lowerBound, rawTarget))
  );

  return {
    bmr,
    maintenanceCalories,
    targetCalories,
    targetWeeklyChangePct,
    floored: targetCalories > rawTarget,
  };
}
