import assert from "node:assert/strict";
import test from "node:test";
import type { CoachSnapshot } from "@/lib/coach-data";
import { formatCoachSnapshotAsMarkdown, formatTrainingSuggestionContext } from "./coach-snapshot-markdown";

function baseSnapshot(overrides: Partial<CoachSnapshot> = {}): CoachSnapshot {
  return {
    progressionDecisions: [],
    generatedFor: "2026-08-31",
    focusSessionId: null,
    periodDays: 28,
    goal: "recomposition",
    targetWeeklyChangePct: -0.25,
    goalWeightKg: 76,
    profile: {
      currentWeightKg: 82,
      goalWeightKg: 76,
      heightCm: 180,
      ageYears: 30,
      biologicalSex: "male",
    },
    targets: { calories: 2450, proteinG: 197, carbsG: 255, fatG: 68 },
    hydration: {
      creatinePhase: "none",
      baselineLiters: 3.1,
      creatineBonusLiters: 0,
      targetLiters: 3.1,
    },
    today: {
      nutrition: { calories: 1200, proteinG: 90, carbsG: 120, fatG: 30 },
      remaining: { calories: 1250, proteinG: 107, carbsG: 135, fatG: 38 },
      expenditure: { day: "2026-08-31", totalCalories: 2780, source: "Garmin sync" },
      garminHealth: null,
    },
    garminHealthTrend: [],
    cardioSessions: [],
    jiuJitsuSessions: [],
    mobilitySessions: [],
    weightTrend: [],
    expenditureTrend: [],
    nutritionTrend: [],
    workouts: [],
    schedule: [],
    todayTraining: null,
    todayJiuJitsuPlanned: false,
    routineTargets: [],
    trainingPlan: { state: null, latestRecoveryCheckin: null },
    commonFoods: [],
    coachMemory: [],
    nutritionPhase: {
      status: "active",
      phaseType: "recomposition",
      title: "Week 5 of your recomposition cut",
      startedOn: "2026-07-27",
      daysElapsed: 29,
      weekNumber: 5,
      observedWeeklyChangePct: -0.42,
      targetWeeklyChangePct: -0.25,
      rateAssessment: "faster_than_planned",
      rateMessage:
        "Your recent trend is -0.42% per week, faster than your -0.25% plan.",
      guidance: "Four-week check-in: review adherence, sleep, and recovery.",
      evidenceRules: [],
    },
    dataCoverage: {
      weighIns: 0,
      expenditureDays: 0,
      garminHealthDays: 0,
      nutritionDays: 0,
      completedWorkouts: 0,
      cardioSessions: 0,
    },
    ...overrides,
  } as CoachSnapshot;
}

test("empty-array sections render placeholder text, not empty tables or a crash", () => {
  const markdown = formatCoachSnapshotAsMarkdown(baseSnapshot());
  assert.match(markdown, /No weigh-ins in this period\./);
  assert.match(markdown, /No completed workouts in this period\./);
  assert.match(markdown, /Nothing recorded yet\./);
  assert.doesNotMatch(markdown, /\|\s*\|\s*\n\|\s*---/); // no header-only/empty table
});

test("weight trend renders a table row per entry with unchanged numbers", () => {
  const markdown = formatCoachSnapshotAsMarkdown(
    baseSnapshot({
      weightTrend: [
        { day: "2026-08-29", weightKg: 82.4 },
        { day: "2026-08-30", weightKg: 82.1 },
      ],
    }),
  );
  assert.match(markdown, /\| 2026-08-29 \| 82\.4 \|/);
  assert.match(markdown, /\| 2026-08-30 \| 82\.1 \|/);
});

test("workout sets are packed chronologically and unambiguously into one cell", () => {
  const markdown = formatCoachSnapshotAsMarkdown(
    baseSnapshot({
      workouts: [
        {
          id: 11,
          date: "2026-08-30",
          name: "Push A",
          durationMinutes: 52,
          volumeKg: 1348,
          exercises: [
            {
              name: "Barbell Bench Press",
              muscleGroup: "Chest",
              sets: [
                { weightKg: 80, reps: 10, rir: 1 },
                { weightKg: 80, reps: 9, rir: 1 },
                { weightKg: 80, reps: 8, rir: 2 },
              ],
            },
          ],
        },
      ],
    }),
  );
  assert.match(
    markdown,
    /### 2026-08-30 — Push A \(duration: 52 min, volume: 1348 kg\)/,
  );
  assert.match(
    markdown,
    /\| Barbell Bench Press \| Chest \| 80×10@1, 80×9@1, 80×8@2 \|/,
  );
});

test("a pipe character in free text is escaped so it can't break a table row", () => {
  const markdown = formatCoachSnapshotAsMarkdown(
    baseSnapshot({
      commonFoods: [
        {
          name: "Rice | Beans combo",
          uses: 3,
          averageGrams: 200,
          averageCalories: 300,
          averageProteinG: 10,
        },
      ],
    }),
  );
  assert.match(markdown, /Rice \\\| Beans combo/);
  const foodLine = markdown.split("\n").find((line) => line.includes("Rice"));
  // The literal pipe is backslash-escaped, so a Markdown table renderer still
  // sees exactly 5 data columns even though the raw string contains 6 "|" characters.
  assert.equal(foodLine, "| Rice \\| Beans combo | 3 | 200 | 300 | 10 |");
});

test("a focus session id surfaces a note pointing at the workouts section", () => {
  const markdown = formatCoachSnapshotAsMarkdown(
    baseSnapshot({ focusSessionId: 11 }),
  );
  assert.match(markdown, /specifically about workout #11/);
});

test("jiu-jitsu appears with effort and same-day strength but no calories", () => {
  const markdown = formatCoachSnapshotAsMarkdown(baseSnapshot({
    todayTraining: "Upper body",
    todayJiuJitsuPlanned: true,
    jiuJitsuSessions: [
      { day: "2026-08-31", durationSeconds: 3900, effort: "hard" },
      { day: "2026-08-29", durationSeconds: null, effort: null },
    ],
    workouts: [{
      id: 3, date: "2026-08-31", name: "Upper body", durationMinutes: 40, volumeKg: 400, exercises: [],
    }],
  }));
  const section = markdown.split("## Completed jiu-jitsu sessions\n")[1].split("\n\n")[0];
  assert.match(section, /\| 2026-08-31 \| 65 \| hard \| yes \|/);
  assert.match(section, /\| 2026-08-29 \| — \| — \| none logged \|/);
  assert.doesNotMatch(section, /calories/i);
  assert.match(markdown, /Today’s gym choice: Upper body\n- Jiu-jitsu planned for today: yes/);
});

test("mobility is presented with session name and elapsed time", () => {
  const markdown = formatCoachSnapshotAsMarkdown(baseSnapshot({
    mobilitySessions: [{ day: "2026-08-31", routine: "Hip mobility", durationSeconds: 150 }],
  }));
  assert.match(markdown, /## Completed mobility sessions\n[\s\S]*\| 2026-08-31 \| Hip mobility \| 2\.5 \|/);
});

test("Garmin recovery compares today's sleep with measured earlier nights", () => {
  const reading = (date: string, sleepDurationSeconds: number, sleepScoreValue: number | null = null) => ({
    date, sleepDurationSeconds, sleepScoreValue, restingHrBpm: null, hrvScore: null,
    hrvBalanceScore: null, caloriesActive: null, caloriesTotal: null, steps: null,
  });
  const markdown = formatCoachSnapshotAsMarkdown(baseSnapshot({
    garminHealthTrend: [
      reading("2026-08-24", 36000),
      reading("2026-08-25", 27000),
      reading("2026-08-29", 28800),
      reading("2026-08-30", 25200),
      reading("2026-08-31", 20100, 54),
      reading("2026-08-28", 0),
    ],
  }));
  const recovery = markdown.split("## Garmin sleep and recovery\n")[1].split("\n\n")[0];
  assert.match(recovery, /Latest sleep recorded for today \(2026-08-31\): 5h 35m, sleep score 54\/100/);
  assert.match(recovery, /Average of 3 earlier measured nights in the last seven days: 7h 30m/);
});

test("training suggestions receive dated sleep evidence alongside gym and jiu-jitsu plans", () => {
  const day = "2026-08-31";
  const routine = { id: 1, name: "Full body" };
  const markdown = formatTrainingSuggestionContext({
    day, routines: [routine], choice: { routineId: 1, jiuJitsu: true },
    defaultRoutineId: null, activeSessionId: null, completedToday: false,
  }, {
    routines: [{ ...routine, muscles: ["Quads"] }], work: [], activities: [],
    checkin: null, isDeload: false, garminSleep: [
      { date: "2026-08-30", sleepDurationSeconds: null, sleepScoreValue: 64 },
      { date: day, sleepDurationSeconds: 0, sleepScoreValue: null },
      { date: "2026-09-01", sleepDurationSeconds: 27000, sleepScoreValue: 95 },
    ],
  });
  assert.match(markdown, /Jiu-jitsu planned for today: yes/);
  assert.match(markdown, /Latest earlier sleep record \(2026-08-30\): sleep score 64\/100/);
  assert.match(markdown, /No Garmin sleep record for today/);
  assert.match(markdown, /\| 2026-08-30 \| — \| 64 \|/);
  assert.doesNotMatch(markdown, /2026-09-01|Latest sleep recorded for today|Average of/);
});

test("the Coach snapshot describes missing Garmin sleep without inventing a value", () => {
  const markdown = formatCoachSnapshotAsMarkdown(baseSnapshot());
  assert.match(markdown, /## Garmin sleep and recovery\nNo Garmin sleep recorded in the last seven days/);
});
