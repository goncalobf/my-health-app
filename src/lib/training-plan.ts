export interface AnchorPerformance {
  weightKg: number;
  totalReps: number;
}

export interface RecoveryCheckin {
  sleepPoor: boolean;
  appetiteLow: boolean;
  jointPain: boolean;
}

export function findDecliningAnchors(
  histories: Record<string, AnchorPerformance[]>
): string[] {
  return Object.entries(histories)
    .filter(([, performances]) => {
      const recent = performances.slice(0, 3);
      if (recent.length < 3) return false;
      const sameWeight = recent.every(
        (performance) => Math.abs(performance.weightKg - recent[0].weightKg) < 0.05
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
}: {
  blockStartedOn: string;
  today: string;
  isDeload: boolean;
  checkin: RecoveryCheckin | null;
  decliningAnchors: string[];
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
      detail: checkin?.sleepPoor || checkin?.appetiteLow
        ? "Your latest check-in reports poorer sleep or lower appetite."
        : "Your latest check-in does not report poorer sleep or appetite.",
    },
    {
      key: "joints",
      active: !!checkin?.jointPain,
      label: "Persistent joint discomfort",
      detail: checkin?.jointPain
        ? "Your latest check-in reports joint discomfort that needs attention."
        : "Your latest check-in does not report persistent joint discomfort.",
    },
  ];
  const triggerCount = triggers.filter((trigger) => trigger.active).length;
  const weekLimitReached = week >= 7;
  const deloadRecommended = !isDeload && (triggerCount >= 2 || weekLimitReached);

  return {
    week,
    triggers,
    triggerCount,
    weekLimitReached,
    deloadRecommended,
    headline: isDeload
      ? "Deload week in progress"
      : deloadRecommended
        ? "Plan a deload next week"
        : triggerCount === 1
          ? "One fatigue signal detected"
          : `Build week ${week}`,
  };
}
