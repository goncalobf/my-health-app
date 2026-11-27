import type { CoachSnapshot } from "@/lib/coach-data";
import { formatSleepDuration, summarizeGarminSleep, type GarminSleepDay } from "./garmin-sleep";
import { loggedMobilityRoutine } from "./mobility";
import { JIU_JITSU, type JiuJitsuEffort } from "./jiu-jitsu";
import type { WorkoutDay } from "./workout-day";
import type { getTrainingSuggestionContext } from "./workout-day-data";

/**
 * Renders a coach data snapshot as Markdown instead of JSON. Repeated-key
 * arrays (workouts, trends) become tables, which the model reads with far
 * fewer tokens than the equivalent array of near-identical objects.
 */
const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function cell(value: unknown): string {
  if (value == null || value === "") return "—";
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function table(
  headers: string[],
  rows: unknown[][],
  emptyText: string,
): string {
  if (rows.length === 0) return `_${emptyText}_`;
  const head = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map(cell).join(" | ")} |`).join("\n");
  return `${head}\n${divider}\n${body}`;
}

function garminSleepSummary(day: string, summary: ReturnType<typeof summarizeGarminSleep>) {
  const latest = summary.nights[0];
  if (!latest) return "No Garmin sleep recorded in the last seven days.";
  const metrics = [
    formatSleepDuration(latest.sleepDurationSeconds),
    latest.sleepScoreValue !== null ? `sleep score ${latest.sleepScoreValue}/100` : null,
  ].filter(Boolean).join(", ");
  const recording = latest.date === day ? "Latest sleep recorded for today" : "Latest earlier sleep record";
  return [
    `- ${recording} (${latest.date}): ${metrics}.`,
    latest.date !== day ? "- No Garmin sleep record for today. Use earlier sleep as background only." : null,
    summary.earlierMeanSeconds === null
      ? "- Fewer than three earlier nights with a measured duration in the last seven days."
      : `- Average of ${summary.earlierRecordedNights} earlier measured nights in the last seven days: ${formatSleepDuration(summary.earlierMeanSeconds)}.`,
  ].filter(Boolean).join("\n");
}

function garminSleepSection(day: string, rows: GarminSleepDay[], includeNights = false) {
  const summary = summarizeGarminSleep(day, rows);
  return [
    "## Garmin sleep and recovery",
    garminSleepSummary(day, summary),
    includeNights && summary.nights.length
      ? table(
        ["Recorded for", "Sleep duration", "Sleep score (/100)"],
        summary.nights.map((row) => [
          row.date, formatSleepDuration(row.sleepDurationSeconds), row.sleepScoreValue,
        ]),
        "",
      )
      : null,
  ].filter(Boolean).join("\n");
}

function mobilityHistory(sessions: { day: string; routine: string; durationSeconds: number | null }[]) {
  return table(
    ["Date", "Routine", "Elapsed minutes"],
    sessions.map(({ day, routine, durationSeconds }) => [
      day, routine, durationSeconds === null ? null : Math.round(durationSeconds / 6) / 10,
    ]),
    "No mobility sessions logged in this period.",
  );
}

function jiuJitsuTable(
  sessions: { day: string; durationSeconds: number | null; effort: JiuJitsuEffort | null }[],
  strengthDays: Set<string>,
) {
  return table(
    ["Date", "Duration (min)", "Reported effort", "Strength logged on same day"],
    sessions.map(({ day, durationSeconds, effort }) => [
      day,
      durationSeconds == null ? null : Math.round(durationSeconds / 60),
      effort,
      strengthDays.has(day) ? "yes" : "none logged",
    ]),
    "No completed jiu-jitsu sessions logged in this period.",
  );
}

function bullets(items: string[], emptyText: string): string {
  if (items.length === 0) return `_${emptyText}_`;
  return items.map((item) => `- ${item}`).join("\n");
}

function weekday(dayOfWeek: number): string {
  return WEEKDAYS[dayOfWeek - 1] ?? `Day ${dayOfWeek}`;
}

function formatSets(
  sets: { weightKg: number; reps: number; rir: number | null }[],
): string {
  return sets
    .map((s) => `${s.weightKg}×${s.reps}${s.rir != null ? `@${s.rir}` : ""}`)
    .join(", ");
}

export function formatCoachSnapshotAsMarkdown(snapshot: CoachSnapshot): string {
  const sections: string[] = [];

  sections.push(
    [
      `# Fitlog data snapshot — generated for ${snapshot.generatedFor}`,
      `Covers the last ${snapshot.periodDays} days.`,
      snapshot.focusSessionId
        ? `**This request is specifically about workout #${snapshot.focusSessionId} in the Workouts section below.**`
        : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  sections.push(
    [
      "## Profile & goal",
      `- Goal: ${cell(snapshot.goal)} (target weekly weight change: ${snapshot.targetWeeklyChangePct}%)`,
      `- Current weight: ${cell(snapshot.profile.currentWeightKg)} kg → goal weight: ${cell(snapshot.profile.goalWeightKg)} kg`,
      `- Height: ${cell(snapshot.profile.heightCm)} cm, age: ${cell(snapshot.profile.ageYears)}, biological sex: ${cell(snapshot.profile.biologicalSex)}`,
    ].join("\n"),
  );

  const t = snapshot.targets;
  const today = snapshot.today;
  sections.push(
    [
      "## Nutrition targets & today",
      `- Daily targets: ${t.calories} kcal · ${t.proteinG}P ${t.carbsG}C ${t.fatG}F`,
      `- Logged today: ${today.nutrition.calories} kcal · ${today.nutrition.proteinG}P ${today.nutrition.carbsG}C ${today.nutrition.fatG}F`,
      `- Remaining today: ${today.remaining.calories} kcal · ${today.remaining.proteinG}P ${today.remaining.carbsG}C ${today.remaining.fatG}F`,
      today.expenditure
        ? `- Total energy expenditure today: ${today.expenditure.totalCalories} kcal (${today.expenditure.source})${today.expenditure.source === "Garmin sync" ? ". Today’s total may still increase." : ""}`
        : "- Total energy expenditure today: no reading.",
    ].join("\n"),
  );

  const hydration = snapshot.hydration;
  sections.push(
    [
      "## Hydration",
      hydration.targetLiters != null
        ? `- Daily water target: ${hydration.targetLiters} L (${hydration.baselineLiters} L baseline at ~37.5 ml/kg${hydration.creatinePhase === "loading" ? ` + ${hydration.creatineBonusLiters} L for an active creatine-loading phase` : ""})`
        : "- No current weight on file, so no water target could be calculated.",
      `- Creatine phase: ${hydration.creatinePhase}${hydration.creatinePhase === "maintenance" ? " (no extra hydration bump — baseline already covers the commonly cited maintenance range)" : ""}`,
    ].join("\n"),
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
    ]
      .filter(Boolean)
      .join("\n"),
  );

  sections.push(
    [
      "## Coach memory (prior sessions — soft context, see instructions)",
      bullets(snapshot.coachMemory, "Nothing recorded yet."),
    ].join("\n"),
  );

  sections.push(
    [
      "## Weight trend",
      table(
        ["Day", "Weight (kg)"],
        snapshot.weightTrend.map((w) => [w.day, w.weightKg]),
        "No weigh-ins in this period.",
      ),
    ].join("\n"),
  );

  sections.push(
    [
      "## Nutrition trend (daily totals)",
      table(
        ["Day", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)"],
        snapshot.nutritionTrend.map((n) => [
          n.day,
          n.calories,
          n.proteinG,
          n.carbsG,
          n.fatG,
        ]),
        "No nutrition logged in this period.",
      ),
    ].join("\n"),
  );

  sections.push(
    [
      "## Daily energy expenditure",
      table(
        ["Day", "Total calories", "Source"],
        snapshot.expenditureTrend.map((e) => [e.day, e.totalCalories, e.source]),
        "No energy expenditure recorded in this period.",
      ),
    ].join("\n"),
  );

  sections.push(garminSleepSection(snapshot.generatedFor, snapshot.garminHealthTrend));

  sections.push(
    [
      "## Garmin health trend",
      table(
        [
          "Date",
          "RHR",
          "HRV",
          "HRV balance",
          "Sleep (h)",
          "Sleep score",
          "Active cal",
          "Steps",
        ],
        snapshot.garminHealthTrend.map((g) => [
          g.date,
          g.restingHrBpm,
          g.hrvScore,
          g.hrvBalanceScore,
          g.sleepDurationSeconds != null && g.sleepDurationSeconds > 0
            ? Math.round((g.sleepDurationSeconds / 3600) * 10) / 10
            : null,
          g.sleepScoreValue,
          g.caloriesActive,
          g.steps,
        ]),
        "No Garmin health data in this period.",
      ),
    ].join("\n"),
  );

  const workoutSections = snapshot.workouts.map((w) => {
    const heading = `### ${w.date} — ${cell(w.name)} (duration: ${cell(w.durationMinutes)} min, volume: ${w.volumeKg} kg)`;
    const body = table(
      ["Exercise", "Muscle group", "Sets (weight×reps@RIR)"],
      w.exercises.map((e) => [e.name, e.muscleGroup, formatSets(e.sets)]),
      "No sets recorded.",
    );
    return `${heading}\n${body}`;
  });
  sections.push(
    [
      "## Workouts",
      workoutSections.length === 0
        ? "_No completed workouts in this period._"
        : workoutSections.join("\n\n"),
    ].join("\n"),
  );

  sections.push(
    [
      "## Cardio sessions",
      table(
        [
          "Date",
          "Type",
          "Duration (min)",
          "Distance (km)",
          "Avg HR",
          "Calories",
          "Avg speed (km/h)",
          "Avg power (W)",
          "Division",
        ],
        snapshot.cardioSessions.map((c) => [
          c.date,
          c.type,
          c.durationMinutes,
          c.distanceKm,
          c.avgHeartRate,
          c.calories,
          c.avgSpeedKmh,
          c.avgPowerW,
          c.division,
        ]),
        "No cardio sessions in this period.",
      ),
    ].join("\n"),
  );

  sections.push(
    [
      "## Completed jiu-jitsu sessions",
      jiuJitsuTable(snapshot.jiuJitsuSessions, new Set(snapshot.workouts.map((workout) => workout.date))),
    ].join("\n"),
  );

  sections.push(["## Completed mobility sessions", mobilityHistory(snapshot.mobilitySessions)].join("\n"));

  sections.push(
    [
      "## Training choices",
      `- Today’s gym choice: ${cell(snapshot.todayTraining ?? "None saved")}`,
      `- Jiu-jitsu planned for today: ${snapshot.todayJiuJitsuPlanned ? "yes" : "none marked"}`,
      "",
      "### Weekly defaults",
      table(
        ["Day", "Routine"],
        snapshot.schedule.map((s) => [weekday(s.dayOfWeek), s.routine]),
        "No schedule configured.",
      ),
    ].join("\n"),
  );

  sections.push(
    [
      "## Routine targets",
      table(
        [
          "Exercise",
          "Target sets",
          "Rep range",
          "RIR range",
          "Increment (kg)",
          "Anchor",
          "Avoid failure",
          "Instruction",
        ],
        snapshot.routineTargets.map((r) => [
          r.exercise,
          r.targetSets,
          `${r.minReps}-${r.maxReps}`,
          r.targetRirMin != null
            ? `${r.targetRirMin}-${r.targetRirMax ?? r.targetRirMin}`
            : null,
          r.incrementKg,
          r.isAnchor ? "yes" : "no",
          r.avoidFailure ? "yes" : "no",
          r.instruction,
        ]),
        "No routine targets configured.",
      ),
    ].join("\n"),
  );

  sections.push(
    [
      "## Common foods",
      table(
        ["Food", "Uses", "Avg grams", "Avg kcal", "Avg protein (g)"],
        snapshot.commonFoods.map((f) => [
          f.name,
          f.uses,
          f.averageGrams,
          f.averageCalories,
          f.averageProteinG,
        ]),
        "No repeated foods in this period.",
      ),
    ].join("\n"),
  );

  sections.push(
    [
      "## Deterministic progression decisions",
      table(
        [
          "Routine",
          "Exercise",
          "Action",
          "Load kg",
          "Comparable exposures",
          "Reason",
        ],
        (snapshot.progressionDecisions ?? []).map((r) => [
          r.routineName,
          r.exerciseName,
          r.action,
          r.weightKg,
          r.comparableSessions,
          r.reason,
        ]),
        "No comparable progression decisions available.",
      ),
    ].join("\n"),
  );
  const coverage = snapshot.dataCoverage;
  sections.push(
    [
      "## Data coverage (use this to judge confidence)",
      `- Weigh-ins: ${coverage.weighIns} · Nutrition days logged: ${coverage.nutritionDays} · Completed workouts: ${coverage.completedWorkouts}`,
      `- Cardio sessions: ${coverage.cardioSessions} · Energy expenditure days: ${coverage.expenditureDays} · Garmin health days: ${coverage.garminHealthDays}`,
    ].join("\n"),
  );

  return sections.join("\n\n");
}

export function formatTrainingSuggestionContext(
  plan: WorkoutDay,
  context: Awaited<ReturnType<typeof getTrainingSuggestionContext>>,
): string {
  const selected = context.routines.find((routine) => routine.id === plan.choice?.routineId);
  const checkin = context.checkin;
  return [
    "## Today's choice",
    `- Date: ${plan.day}`,
    `- Gym: ${selected ? cell(selected.name) + " (#" + selected.id + ")" : plan.choice?.jiuJitsu ? "No gym workout" : "Rest"}`,
    `- Jiu-jitsu planned for today: ${plan.choice?.jiuJitsu ? "yes" : "none marked"}`,
    `- Deload active: ${context.isDeload ? "yes" : "no"}`,
    checkin
      ? `- Recovery check-in (${checkin.day}): poor sleep ${checkin.sleepPoor}, low appetite ${checkin.appetiteLow}, joint pain ${checkin.jointPain}`
      : "- No recent recovery check-in.",
    "",
    garminSleepSection(plan.day, context.garminSleep, true),
    "",
    "## Available routines",
    table(["ID", "Name", "Primary muscles"], context.routines.map((r) => [
      r.id, r.name, r.muscles.join(", "),
    ]), "No saved routines with exercises."),
    "",
    "## Recent completed strength sessions",
    table(["Date", "Session", "Muscle group", "Working sets"], context.work.map((r) => [
      r.day, r.name, r.muscle, r.sets,
    ]), "No recent working sets logged."),
    "",
    "## Recent completed cardio",
    table(["Date", "Type", "Minutes"], context.activities.filter((r) => r.type !== JIU_JITSU && !loggedMobilityRoutine(r.type)).map((r) => [
      r.day, r.type, r.durationSeconds == null ? null : Math.round(r.durationSeconds / 60),
    ]), "No recent cardio logged."),
    "",
    "## Completed mobility sessions",
    mobilityHistory(context.activities.flatMap((row) => {
      const routine = loggedMobilityRoutine(row.type);
      return routine ? [{ day: row.day, routine: routine.name, durationSeconds: row.durationSeconds }] : [];
    })),
    "",
    "## Completed jiu-jitsu sessions",
    jiuJitsuTable(
      context.activities.filter((r) => r.type === JIU_JITSU),
      new Set(context.work.map((r) => r.day)),
    ),
  ].join("\n");
}
