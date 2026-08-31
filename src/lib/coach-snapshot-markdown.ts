import type { CoachSnapshot } from "@/lib/coach-data";

/**
 * Renders a coach data snapshot as Markdown instead of JSON. Repeated-key
 * arrays (workouts, trends) become tables, which the model reads with far
 * fewer tokens than the equivalent array of near-identical objects.
 */
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function cell(value: unknown): string {
  if (value == null || value === "") return "—";
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function table(headers: string[], rows: unknown[][], emptyText: string): string {
  if (rows.length === 0) return `_${emptyText}_`;
  const head = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(cell).join(" | ")} |`).join("\n");
  return `${head}\n${divider}\n${body}`;
}

function bullets(items: string[], emptyText: string): string {
  if (items.length === 0) return `_${emptyText}_`;
  return items.map((item) => `- ${item}`).join("\n");
}

function weekday(dayOfWeek: number): string {
  return WEEKDAYS[dayOfWeek - 1] ?? `Day ${dayOfWeek}`;
}

function formatSets(sets: { weightKg: number; reps: number; rir: number | null }[]): string {
  return sets.map((s) => `${s.weightKg}×${s.reps}${s.rir != null ? `@${s.rir}` : ""}`).join(", ");
}

export function formatCoachSnapshotAsMarkdown(snapshot: CoachSnapshot): string {
  const sections: string[] = [];

  sections.push(
    [
      `# Fitlog data snapshot — generated for ${snapshot.generatedFor}`,
      `Covers the last ${snapshot.periodDays} days.`,
      snapshot.focusSessionId ? `**This request is specifically about workout #${snapshot.focusSessionId} in the Workouts section below.**` : null,
    ].filter(Boolean).join("\n")
  );

  sections.push(
    [
      "## Profile & goal",
      `- Goal: ${cell(snapshot.goal)} (target weekly weight change: ${snapshot.targetWeeklyChangePct}%)`,
      `- Current weight: ${cell(snapshot.profile.currentWeightKg)} kg → goal weight: ${cell(snapshot.profile.goalWeightKg)} kg`,
      `- Height: ${cell(snapshot.profile.heightCm)} cm, age: ${cell(snapshot.profile.ageYears)}, biological sex: ${cell(snapshot.profile.biologicalSex)}`,
    ].join("\n")
  );

  const t = snapshot.targets;
  const today = snapshot.today;
  sections.push(
    [
      "## Nutrition targets & today",
      `- Daily targets: ${t.calories} kcal · ${t.proteinG}P ${t.carbsG}C ${t.fatG}F`,
      `- Logged today: ${today.nutrition.calories} kcal · ${today.nutrition.proteinG}P ${today.nutrition.carbsG}C ${today.nutrition.fatG}F`,
      `- Remaining today: ${today.remaining.calories} kcal · ${today.remaining.proteinG}P ${today.remaining.carbsG}C ${today.remaining.fatG}F`,
      `- Garmin total calories today: ${cell(today.garminTotalCalories)}`,
    ].join("\n")
  );

  const phase = snapshot.nutritionPhase;
  sections.push(
    [
      "## Nutrition phase",
      `- Status: ${phase.status} — ${phase.title}`,
      `- Week ${cell(phase.weekNumber)}, day ${cell(phase.daysElapsed)} of the phase (started ${cell(phase.startedOn)})`,
      `- Observed weekly change: ${cell(phase.observedWeeklyChangePct != null ? `${phase.observedWeeklyChangePct}%` : null)} vs. target ${phase.targetWeeklyChangePct}%`,
      `- Rate assessment: ${phase.rateAssessment} — ${phase.rateMessage}`,
      phase.guidance ? `- Guidance: ${phase.guidance}` : null,
    ].filter(Boolean).join("\n")
  );

  sections.push(
    ["## Coach memory (prior sessions — soft context, see instructions)", bullets(snapshot.coachMemory, "Nothing recorded yet.")].join("\n")
  );

  sections.push(
    [
      "## Weight trend",
      table(["Day", "Weight (kg)"], snapshot.weightTrend.map((w) => [w.day, w.weightKg]), "No weigh-ins in this period."),
    ].join("\n")
  );

  sections.push(
    [
      "## Nutrition trend (daily totals)",
      table(
        ["Day", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)"],
        snapshot.nutritionTrend.map((n) => [n.day, n.calories, n.proteinG, n.carbsG, n.fatG]),
        "No nutrition logged in this period."
      ),
    ].join("\n")
  );

  sections.push(
    [
      "## Garmin expenditure",
      table(["Day", "Total calories"], snapshot.expenditureTrend.map((e) => [e.day, e.totalCalories]), "No Garmin expenditure in this period."),
    ].join("\n")
  );

  sections.push(
    [
      "## Garmin health trend",
      table(
        ["Date", "RHR", "HRV", "HRV balance", "Sleep (h)", "Sleep score", "Active cal", "Total cal", "Steps"],
        snapshot.garminHealthTrend.map((g) => [
          g.date,
          g.restingHrBpm,
          g.hrvScore,
          g.hrvBalanceScore,
          g.sleepDurationSeconds != null ? Math.round((g.sleepDurationSeconds / 3600) * 10) / 10 : null,
          g.sleepScoreValue,
          g.caloriesActive,
          g.caloriesTotal,
          g.steps,
        ]),
        "No Garmin health data in this period."
      ),
    ].join("\n")
  );

  const workoutSections = snapshot.workouts.map((w) => {
    const heading = `### ${w.date} — ${cell(w.name)} (duration: ${cell(w.durationMinutes)} min, volume: ${w.volumeKg} kg)`;
    const body = table(
      ["Exercise", "Muscle group", "Sets (weight×reps@RIR)"],
      w.exercises.map((e) => [e.name, e.muscleGroup, formatSets(e.sets)]),
      "No sets recorded."
    );
    return `${heading}\n${body}`;
  });
  sections.push(
    ["## Workouts", workoutSections.length === 0 ? "_No completed workouts in this period._" : workoutSections.join("\n\n")].join("\n")
  );

  sections.push(
    [
      "## Cardio sessions",
      table(
        ["Date", "Type", "Duration (min)", "Distance (km)", "Avg HR", "Calories", "Avg speed (km/h)", "Avg power (W)", "Division"],
        snapshot.cardioSessions.map((c) => [c.date, c.type, c.durationMinutes, c.distanceKm, c.avgHeartRate, c.calories, c.avgSpeedKmh, c.avgPowerW, c.division]),
        "No cardio sessions in this period."
      ),
    ].join("\n")
  );

  sections.push(
    [
      "## Weekly schedule",
      table(["Day", "Routine"], snapshot.schedule.map((s) => [weekday(s.dayOfWeek), s.routine]), "No schedule configured."),
    ].join("\n")
  );

  sections.push(
    [
      "## Routine targets",
      table(
        ["Exercise", "Target sets", "Rep range", "RIR range", "Increment (kg)", "Anchor", "Avoid failure", "Instruction"],
        snapshot.routineTargets.map((r) => [
          r.exercise,
          r.targetSets,
          `${r.minReps}-${r.maxReps}`,
          r.targetRirMin != null ? `${r.targetRirMin}-${r.targetRirMax ?? r.targetRirMin}` : null,
          r.incrementKg,
          r.isAnchor ? "yes" : "no",
          r.avoidFailure ? "yes" : "no",
          r.instruction,
        ]),
        "No routine targets configured."
      ),
    ].join("\n")
  );

  sections.push(
    [
      "## Common foods",
      table(
        ["Food", "Uses", "Avg grams", "Avg kcal", "Avg protein (g)"],
        snapshot.commonFoods.map((f) => [f.name, f.uses, f.averageGrams, f.averageCalories, f.averageProteinG]),
        "No repeated foods in this period."
      ),
    ].join("\n")
  );

  const coverage = snapshot.dataCoverage;
  sections.push(
    [
      "## Data coverage (use this to judge confidence)",
      `- Weigh-ins: ${coverage.weighIns} · Nutrition days logged: ${coverage.nutritionDays} · Completed workouts: ${coverage.completedWorkouts}`,
      `- Cardio sessions: ${coverage.cardioSessions} · Garmin expenditure days: ${coverage.garminExpendityureDays} · Garmin health days: ${coverage.garminHealthDays}`,
    ].join("\n")
  );

  return sections.join("\n\n");
}
