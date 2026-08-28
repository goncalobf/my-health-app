const CUTTING_GOALS = new Set(["fat_loss", "recomposition"]);
const DAY_MS = 86_400_000;

export interface PhaseWeight {
  day: string;
  weightKg: number;
}

export interface NutritionPhase {
  status: "inactive" | "setup_required" | "active";
  phaseType: "fat_loss" | "recomposition" | null;
  title: string;
  startedOn: string | null;
  daysElapsed: number | null;
  weekNumber: number | null;
  observedWeeklyChangePct: number | null;
  targetWeeklyChangePct: number;
  rateAssessment:
    | "insufficient_data"
    | "faster_than_planned"
    | "slower_than_planned"
    | "on_plan";
  rateMessage: string;
  guidance: string;
  evidenceRules: string[];
}

function dayNumber(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return Number.NaN;
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return Number.NaN;
  const value = new Date(Date.UTC(year, month - 1, date));
  if (value.toISOString().slice(0, 10) !== day) return Number.NaN;
  return value.getTime() / DAY_MS;
}

function estimateWeeklyWeightChangePct(weights: PhaseWeight[]) {
  const byDay = new Map<string, number[]>();
  for (const row of weights) {
    if (!Number.isFinite(row.weightKg) || !Number.isFinite(dayNumber(row.day))) continue;
    byDay.set(row.day, [...(byDay.get(row.day) ?? []), row.weightKg]);
  }
  const points = [...byDay]
    .map(([day, values]) => ({
      x: dayNumber(day),
      y: values.reduce((sum, value) => sum + value, 0) / values.length,
    }))
    .sort((a, b) => a.x - b.x);
  if (points.length < 3 || points[points.length - 1].x - points[0].x < 7) {
    return null;
  }

  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce(
    (sum, point) => sum + (point.x - meanX) ** 2,
    0
  );
  if (denominator === 0 || meanY <= 0) return null;
  const slope =
    points.reduce(
      (sum, point) => sum + (point.x - meanX) * (point.y - meanY),
      0
    ) / denominator;
  return Math.round(((slope * 7) / meanY) * 10_000) / 100;
}

export function buildNutritionPhase({
  goal,
  startedOn,
  today,
  targetWeeklyChangePct,
  weights,
}: {
  goal: string;
  startedOn: string | null;
  today: string;
  targetWeeklyChangePct: number;
  weights: PhaseWeight[];
}): NutritionPhase {
  const evidenceRules = [
    "A gradual loss of roughly 0.5-1.0% of body weight per week is a common resistance-trained fat-loss range; leaner athletes may benefit from a slower rate.",
    "There is no universal evidence-based maximum cut length; duration should be reviewed together with performance, recovery, adherence, and symptoms.",
    "Maintenance breaks are optional. Trials show they can be used without preventing fat loss, but they are not automatically superior to continuous moderate restriction.",
  ];
  if (!CUTTING_GOALS.has(goal)) {
    return {
      status: "inactive",
      phaseType: null,
      title: "No cutting phase active",
      startedOn: null,
      daysElapsed: null,
      weekNumber: null,
      observedWeeklyChangePct: null,
      targetWeeklyChangePct,
      rateAssessment: "insufficient_data",
      rateMessage: "Phase tracking activates for fat loss or recomposition.",
      guidance: "",
      evidenceRules,
    };
  }

  const phaseType = goal as "fat_loss" | "recomposition";
  const elapsed = startedOn
    ? dayNumber(today) - dayNumber(startedOn) + 1
    : Number.NaN;
  if (!startedOn || !Number.isFinite(elapsed) || elapsed < 1) {
    return {
      status: "setup_required",
      phaseType,
      title: "Set your cutting-phase start date",
      startedOn: null,
      daysElapsed: null,
      weekNumber: null,
      observedWeeklyChangePct: null,
      targetWeeklyChangePct,
      rateAssessment: "insufficient_data",
      rateMessage: "Fitlog needs the start date before it can track your phase duration.",
      guidance: "Add the date in Settings. Backdate it if this phase is already underway.",
      evidenceRules,
    };
  }

  const daysElapsed = Math.floor(elapsed);
  const weekNumber = Math.floor((daysElapsed - 1) / 7) + 1;
  const observedWeeklyChangePct = estimateWeeklyWeightChangePct(weights);
  const plannedLoss = Math.abs(targetWeeklyChangePct);
  const observedLoss = observedWeeklyChangePct === null
    ? null
    : -observedWeeklyChangePct;
  let rateAssessment: NutritionPhase["rateAssessment"] = "insufficient_data";
  let rateMessage = "Log at least three weigh-ins spanning seven days to assess your rate.";
  if (observedLoss !== null) {
    const tolerance = Math.max(0.15, plannedLoss * 0.35);
    if (observedLoss > plannedLoss + tolerance) {
      rateAssessment = "faster_than_planned";
      rateMessage = `Your recent trend is ${observedWeeklyChangePct}% per week, faster than your ${targetWeeklyChangePct}% plan. Review recovery and training performance before extending the deficit.`;
    } else if (observedLoss < Math.max(0, plannedLoss - tolerance)) {
      rateAssessment = "slower_than_planned";
      rateMessage = `Your recent trend is ${observedWeeklyChangePct}% per week, slower than your ${targetWeeklyChangePct}% plan. Check logging consistency before reducing calories.`;
    } else {
      rateAssessment = "on_plan";
      rateMessage = `Your recent trend is ${observedWeeklyChangePct}% per week, close to your ${targetWeeklyChangePct}% plan.`;
    }
  }

  let guidance: string;
  if (weekNumber < 4) {
    guidance = "Build a stable baseline. Keep calories consistent and avoid reacting to a few days of scale noise.";
  } else if (weekNumber < 8) {
    guidance = "Four-week check-in: review average weight change, food adherence, gym performance, hunger, sleep, and recovery before changing the plan.";
  } else if (weekNumber < 12) {
    guidance = "Extended-phase check-in: look for accumulating fatigue, persistent hunger, poorer sleep, low mood, or declining performance. A maintenance week is optional if those signals are building.";
  } else {
    guidance = "This is a long cutting phase. Consider a 1-2 week maintenance phase if recovery, adherence, mood, or training performance have deteriorated; duration alone does not prove a break is required.";
  }

  return {
    status: "active",
    phaseType,
    title: `Week ${weekNumber} of your ${goal === "recomposition" ? "recomposition cut" : "cut"}`,
    startedOn,
    daysElapsed,
    weekNumber,
    observedWeeklyChangePct,
    targetWeeklyChangePct,
    rateAssessment,
    rateMessage,
    guidance,
    evidenceRules,
  };
}
