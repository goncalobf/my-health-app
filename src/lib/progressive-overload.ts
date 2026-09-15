import type { EquipmentProfile } from "./training-prescription";
export interface ProgressionSet {
  weightKg: number;
  reps: number;
  rir?: number | null;
  setNumber?: number;
}
export interface ProgressionTarget {
  targetSets: number;
  minReps: number;
  maxReps: number;
  weightIncrementKg: number;
  targetWeightKg?: number | null;
  targetRirMin?: number | null;
  targetRirMax?: number | null;
  equipmentProfile?: EquipmentProfile | null;
}
export interface ProgressionRecommendation {
  action: "start" | "increase" | "repeat" | "reduce";
  weightKg: number | null;
  message: string;
  reason: string;
  nextReps?: number[];
}
// PostgreSQL real introduces small storage error; distinct microloads remain distinct.
export const sameLoad = (a: number, b: number) =>
  Number.isFinite(a) &&
  Number.isFinite(b) &&
  Math.abs(a - b) <=
    Math.max(0.0001, Math.max(Math.abs(a), Math.abs(b)) * 0.000001);
export const roundLoad = (value: number) => Math.round(value * 1000) / 1000;
export function plannedSets(target: ProgressionTarget, sets: ProgressionSet[]) {
  return sets
    .filter(
      (s, i) =>
        (s.setNumber ?? i + 1) <= target.targetSets &&
        (s.setNumber ?? i + 1) > 0,
    )
    .slice(0, target.targetSets);
}
export function completeStraightSets(
  target: ProgressionTarget,
  sets: ProgressionSet[],
) {
  const planned = plannedSets(target, sets);
  return (
    planned.length === target.targetSets &&
    new Set(planned.map((s, i) => s.setNumber ?? i + 1)).size ===
      target.targetSets &&
    planned.every(
      (s) =>
        Number.isFinite(s.weightKg) &&
        s.weightKg >= 0 &&
        Number.isInteger(s.reps) &&
        s.reps > 0 &&
        sameLoad(s.weightKg, planned[0].weightKg),
    )
  );
}
/** Next physically available setting; assistance progresses in the opposite direction. */
export function nextLoad(
  weight: number,
  target: ProgressionTarget,
  harder: boolean,
): number | null {
  if (target.equipmentProfile?.loading === "bodyweight") return null;
  const direction =
    (harder ? 1 : -1) *
    (target.equipmentProfile?.loading === "assistance" ? -1 : 1);
  const ladder = [
    ...new Set(target.equipmentProfile?.availableLoads ?? []),
  ].sort((a, b) => a - b);
  if (ladder.length)
    return (
      (direction > 0
        ? ladder.find((w) => w > weight + 0.001)
        : ladder.filter((w) => w < weight - 0.001).at(-1)) ?? null
    );
  const next = roundLoad(
    Math.max(0, weight + direction * target.weightIncrementKg),
  );
  return next === weight ? null : next;
}
/** Caller supplies newest-first, prior, comparable, normal-session working sets only. */
export function getProgressionRecommendation(
  target: ProgressionTarget,
  history: ProgressionSet[][],
): ProgressionRecommendation {
  const latest = plannedSets(target, history[0] ?? []);
  if (!latest.length)
    return {
      action: "start",
      weightKg: target.targetWeightKg ?? null,
      message:
        target.targetWeightKg != null
          ? `Start at ${target.targetWeightKg}kg for ${target.minReps} reps`
          : `Choose a comfortable load for ${target.minReps} reps`,
      reason:
        "No comparable baseline yet. Use the same setup and record actual RIR; older, different-prescription and deload sessions are not evidence for an increase.",
    };
  const weight = latest[0].weightKg;
  if (!latest.every((s) => sameLoad(s.weightKg, weight)))
    return {
      action: "repeat",
      weightKg: null,
      message: "Mixed loads · review each working set",
      reason:
        "Top sets and back-off sets are different efforts. Keep their individual loads; an automatic single-load increase would be misleading.",
    };
  if (!completeStraightSets(target, history[0]))
    return {
      action: "repeat",
      weightKg: weight,
      message: `Keep ${weight}kg · complete the planned sets`,
      reason:
        "This exposure is incomplete. Skipped or missing sets do not qualify for an increase or a reduction.",
    };
  const reachedTop = latest.every((s) => s.reps >= target.maxReps);
  const rirMaintained =
    target.targetRirMin == null ||
    latest.every((s) => s.rir != null && s.rir >= target.targetRirMin!);
  if (reachedTop && rirMaintained) {
    const next = nextLoad(weight, target, true);
    return next == null
      ? {
          action: "repeat",
          weightKg: weight,
          message: "Range complete · review the next progression",
          reason:
            "No harder load is available in this equipment profile. Review the rep range or exercise variation instead of inventing a weight.",
        }
      : {
          action: "increase",
          weightKg: next,
          message: `${target.equipmentProfile?.loading === "assistance" ? "Reduce assistance" : "Increase"} to ${next}kg · aim for ${target.minReps} reps`,
          reason: `You reached ${target.maxReps} reps on all ${target.targetSets} planned sets at the same load without going below the target RIR. Use the same setup.`,
          nextReps: Array(target.targetSets).fill(target.minReps),
        };
  }
  const missedTwice =
    history.length >= 2 &&
    history.slice(0, 2).every((sets) => {
      const p = plannedSets(target, sets);
      return (
        completeStraightSets(target, sets) &&
        sameLoad(p[0].weightKg, weight) &&
        p.some(
          (s) =>
            s.reps < target.minReps &&
            (target.targetRirMin == null ||
              (s.rir != null &&
                s.rir <= (target.targetRirMax ?? target.targetRirMin))),
        )
      );
    });
  if (missedTwice) {
    const next = nextLoad(weight, target, false);
    if (next != null)
      return {
        action: "reduce",
        weightKg: next,
        message: `Use ${next}kg and rebuild`,
        reason: `A working set missed ${target.minReps} reps in two complete comparable sessions at this load. Review rest and technique too. This is not a full deload week.`,
      };
  }
  if (reachedTop && !rirMaintained)
    return {
      action: "repeat",
      weightKg: weight,
      message: `Keep ${weight}kg · confirm the target RIR`,
      reason: `At least one planned set was missing RIR or went below RIR ${target.targetRirMin}. Repeat before increasing; unknown effort stays unknown.`,
    };
  const nextReps = latest.map((s) =>
    Math.min(target.maxReps, Math.max(target.minReps, s.reps)),
  );
  const grow = latest.findIndex(
    (s) => s.reps >= target.minReps && s.reps < target.maxReps,
  );
  if (grow >= 0) nextReps[grow]++;
  const plateau =
    history.length >= 3 &&
    history
      .slice(0, 3)
      .every(
        (sets) =>
          completeStraightSets(target, sets) &&
          sameLoad(sets[0].weightKg, weight) &&
          plannedSets(target, sets).reduce((n, s) => n + s.reps, 0) ===
            latest.reduce((n, s) => n + s.reps, 0),
      );
  return {
    action: "repeat",
    weightKg: weight,
    message: `Keep ${weight}kg · aim for ${nextReps.join(" / ")} reps`,
    nextReps,
    reason: plateau
      ? "Reps have held steady across three comparable exposures. Review actual RIR, rest, technique and recovery before changing volume. This is a review prompt, not proof of a plateau."
      : `Aim for one more clean rep overall while maintaining the target RIR. Repeat when needed; progress does not require a weight increase every week.`,
  };
}
