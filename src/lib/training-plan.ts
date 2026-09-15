import { sameLoad } from "./progressive-overload";
export interface AnchorPerformance {
  weightKg: number;
  totalReps: number;
  setCount: number;
}

export interface RecoveryCheckin {
  sleepPoor: boolean;
  appetiteLow: boolean;
  jointPain: boolean;
}

export function findDecliningAnchors(
  histories: Record<string, AnchorPerformance[]>,
): string[] {
  return Object.entries(histories)
    .filter(([, performances]) => {
      const recent = performances.slice(0, 3);
      if (recent.length < 3) return false;
      const sameWeight = recent.every(
        (performance) =>
          sameLoad(performance.weightKg, recent[0].weightKg) &&
          performance.setCount === recent[0].setCount,
      );
      return (
        sameWeight &&
        recent[0].totalReps < recent[1].totalReps &&
        recent[1].totalReps < recent[2].totalReps
      );
    })
    .map(([name]) => name);
}

function dayDifference(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function buildTrainingPlanStatus({
  blockStartedOn,
  today,
  isDeload,
  checkin,
  decliningAnchors,
  recentCheckins = [],
}: {
  blockStartedOn: string;
  today: string;
  isDeload: boolean;
  checkin: RecoveryCheckin | null;
  decliningAnchors: string[];
  recentCheckins?: RecoveryCheckin[];
}) {
  const week = Math.floor(dayDifference(blockStartedOn, today) / 7) + 1;
  const triggers = [
    {
      key: "performance",
      active: decliningAnchors.length > 0,
      label: "Performance declining",
      detail: decliningAnchors.length
        ? `${decliningAnchors.join(", ")} declined at the same load in two consecutive comparisons.`
        : "No anchor has declined at the same load for two workouts in a row.",
    },
    {
      key: "recovery",
      active: !!(checkin?.sleepPoor || checkin?.appetiteLow),
      label: "Sleep or appetite worsening",
      detail:
        checkin?.sleepPoor || checkin?.appetiteLow
          ? "Your latest check-in reports poorer sleep or lower appetite."
          : checkin
            ? "Your latest check-in does not report poorer sleep or appetite."
            : "Recovery unknown: no recent check-in.",
    },
    {
      key: "joints",
      active: !!checkin?.jointPain,
      label: "Joint discomfort",
      detail: checkin?.jointPain
        ? "Your latest check-in reports joint discomfort that needs attention."
        : checkin
          ? "Your latest check-in does not report joint discomfort."
          : "Joint status unknown: no recent check-in.",
    },
  ];
  const triggerCount = triggers.filter((trigger) => trigger.active).length;
  const weekLimitReached = week >= 7;
  // Repeated check-ins on different days are supplied by the caller. The
  // two-signal threshold is a conservative review heuristic, not a diagnosis.
  const sustainedRecovery =
    !!(checkin?.sleepPoor || checkin?.appetiteLow) &&
    recentCheckins.filter((c) => c.sleepPoor || c.appetiteLow).length >= 2;
  const sustainedJoints =
    !!checkin?.jointPain &&
    recentCheckins.filter((c) => c.jointPain).length >= 2;
  const sustainedCount =
    Number(decliningAnchors.length > 0) +
    Number(sustainedRecovery) +
    Number(sustainedJoints);
  const deloadRecommended = !isDeload && sustainedCount >= 2;

  return {
    week,
    triggers,
    triggerCount,
    weekLimitReached,
    reviewDue: weekLimitReached,
    deloadRecommended,
    headline: isDeload
      ? "Deload week in progress"
      : deloadRecommended
        ? "Consider a deload"
        : triggerCount === 1
          ? "One fatigue signal detected"
          : weekLimitReached
            ? "Review your training block"
            : `Build week ${week}`,
  };
}
