import type { EquipmentProfile } from "./training-prescription";
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
  previousSet?: PrefillReference | null,
): PrefilledSet {
  const weightKg =
    [
      target.recommendedWeightKg,
      lastSession?.weightKg,
      previousSet?.weightKg,
    ].find((v) => v != null && Number.isFinite(v) && v >= 0) ?? 0;

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
export function suggestDropWeight(
  weightKg: number,
  incrementKg: number,
  profile?: EquipmentProfile | null,
): number {
  if (
    !Number.isFinite(weightKg) ||
    weightKg < 0 ||
    profile?.loading === "bodyweight"
  )
    return weightKg;
  const step =
    Number.isFinite(incrementKg) && incrementKg > 0 ? incrementKg : 2.5;
  const assisted = profile?.loading === "assistance";
  const target = assisted
    ? Math.max(weightKg / 0.8, weightKg + step)
    : Math.min(weightKg * 0.8, weightKg - step);
  if (profile?.availableLoads.length) {
    const easier = profile.availableLoads.filter((w) =>
      assisted ? w > weightKg : w < weightKg,
    );
    return (
      easier.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0] ??
      weightKg
    );
  }
  const snapped = Math.round(target / step) * step;
  return Math.max(
    0,
    Math.round(
      (assisted
        ? Math.max(snapped, weightKg + step)
        : Math.min(snapped, weightKg - step)) * 1000,
    ) / 1000,
  );
}
