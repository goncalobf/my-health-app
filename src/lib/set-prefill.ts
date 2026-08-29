export interface PrefillTarget {
  minReps: number;
  maxReps: number;
  recommendedWeightKg: number | null;
  recommendationAction: "start" | "increase" | "repeat" | "reduce" | null;
}

export interface PrefillReference {
  weightKg: number;
  reps: number;
}

export interface PrefilledSet {
  weightKg: number;
  reps: number;
}

function firstPositive(...values: (number | null | undefined)[]): number {
  for (const value of values) {
    if (value != null && Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

/**
 * Chooses the weight and reps an unlogged set opens with.
 *
 * The progression engine owns what should happen next; this only decides which
 * of its outputs, the matching set from last session, or the previous set of
 * this session is the most useful starting point.
 */
export function prefillSet(
  target: PrefillTarget,
  lastSession?: PrefillReference | null,
  previousSet?: PrefillReference | null
): PrefilledSet {
  const weightKg = firstPositive(
    target.recommendedWeightKg,
    lastSession?.weightKg,
    previousSet?.weightKg
  );

  // Adding load resets the rep target to the bottom of the range; holding it
  // means the goal is to beat last session's reps, so start where they ended.
  const reps =
    target.recommendationAction === "repeat"
      ? firstPositive(lastSession?.reps, target.minReps, previousSet?.reps)
      : firstPositive(target.minReps, lastSession?.reps, previousSet?.reps);

  return { weightKg, reps };
}

/**
 * Suggests the opening load for a drop, always at least one increment lighter
 * than the effort it follows. The lifter is free to change it.
 */
export function suggestDropWeight(weightKg: number, incrementKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0;
  const step = Number.isFinite(incrementKg) && incrementKg > 0 ? incrementKg : 2.5;
  const snapped = Math.round((weightKg * 0.8) / step) * step;
  const atLeastOneStepLighter = Math.min(snapped, weightKg - step);
  return Math.max(0, Math.round(atLeastOneStepLighter * 100) / 100);
}
