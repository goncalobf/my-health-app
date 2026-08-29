export interface ProgressionSet {
  weightKg: number;
  reps: number;
  rir?: number | null;
}

export interface ProgressionTarget {
  targetSets: number;
  minReps: number;
  maxReps: number;
  weightIncrementKg: number;
  targetWeightKg?: number | null;
  targetRirMin?: number | null;
  targetRirMax?: number | null;
}

export interface ProgressionRecommendation {
  action: "start" | "increase" | "repeat" | "reduce";
  weightKg: number | null;
  message: string;
  reason: string;
}

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

export function getProgressionRecommendation(
  target: ProgressionTarget,
  history: ProgressionSet[][]
): ProgressionRecommendation {
  const latest = history[0];
  if (!latest?.length) {
    return {
      action: "start",
      weightKg: target.targetWeightKg ?? null,
      message: target.targetWeightKg
        ? `Start at ${target.targetWeightKg}kg for ${target.minReps} reps`
        : `Choose a comfortable load for ${target.minReps} reps`,
      reason: `Begin at the bottom of the ${target.minReps}–${target.maxReps} range while keeping the prescribed RIR.`,
    };
  }

  const workingWeight = Math.max(...latest.map((set) => set.weightKg));
  const enoughSets = latest.length >= target.targetSets;
  const reachedTop =
    enoughSets && latest.slice(0, target.targetSets).every((set) => set.reps >= target.maxReps);
  const rirRequired = target.targetRirMin != null;
  const rirMaintained =
    !rirRequired ||
    latest
      .slice(0, target.targetSets)
      .every((set) => set.rir != null && set.rir >= target.targetRirMin!);
  const missedMinimumTwice =
    history.length >= 2 &&
    history.slice(0, 2).every((sets) =>
      sets.slice(0, target.targetSets).some((set) => set.reps < target.minReps)
    );

  if (reachedTop && rirMaintained) {
    const next = rounded(workingWeight + target.weightIncrementKg);
    return {
      action: "increase",
      weightKg: next,
      message: `Increase to ${next}kg · aim for ${target.minReps} reps`,
      reason: `You reached ${target.maxReps} reps on all ${target.targetSets} planned sets without going below the target RIR, so the range is complete.`,
    };
  }

  if (missedMinimumTwice) {
    const next = Math.max(0, rounded(workingWeight - target.weightIncrementKg));
    return {
      action: "reduce",
      weightKg: next,
      message: `Reduce to ${next}kg and rebuild`,
      reason: `At least one set fell below ${target.minReps} reps in each of the last two sessions. This is a load adjustment, not a full deload week.`,
    };
  }

  if (reachedTop && !rirMaintained) {
    return {
      action: "repeat",
      weightKg: workingWeight,
      message: `Keep ${workingWeight}kg · confirm the target RIR`,
      reason: `You reached the top reps, but at least one planned set was missing RIR or went below RIR ${target.targetRirMin}. Repeat the load before increasing it.`,
    };
  }

  return {
    action: "repeat",
    weightKg: workingWeight,
    message: `Keep ${workingWeight}kg · add reps toward ${target.maxReps}`,
    reason: `The top of the range was not reached on every planned set, so weight stays fixed while reps progress.`,
  };
}
