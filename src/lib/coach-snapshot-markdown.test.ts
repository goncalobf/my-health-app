import assert from "node:assert/strict";
import test from "node:test";
import type { CoachSnapshot } from "@/lib/coach-data";
import { formatCoachSnapshotAsMarkdown } from "./coach-snapshot-markdown";

function baseSnapshot(overrides: Partial<CoachSnapshot> = {}): CoachSnapshot {
  return {
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
    today: {
      nutrition: { calories: 1200, proteinG: 90, carbsG: 120, fatG: 30 },
      remaining: { calories: 1250, proteinG: 107, carbsG: 135, fatG: 38 },
      garminTotalCalories: 2780,
      garminHealth: null,
    },
    garminHealthTrend: [],
    cardioSessions: [],
    weightTrend: [],
    expenditureTrend: [],
    nutritionTrend: [],
    workouts: [],
    schedule: [],
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
      rateMessage: "Your recent trend is -0.42% per week, faster than your -0.25% plan.",
      guidance: "Four-week check-in: review adherence, sleep, and recovery.",
      evidenceRules: [],
    },
    dataCoverage: {
      weighIns: 0,
      garminExpendityureDays: 0,
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
    baseSnapshot({ weightTrend: [{ day: "2026-08-29", weightKg: 82.4 }, { day: "2026-08-30", weightKg: 82.1 }] })
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
    })
  );
  assert.match(markdown, /### 2026-08-30 — Push A \(duration: 52 min, volume: 1348 kg\)/);
  assert.match(markdown, /\| Barbell Bench Press \| Chest \| 80×10@1, 80×9@1, 80×8@2 \|/);
});

test("a pipe character in free text is escaped so it can't break a table row", () => {
  const markdown = formatCoachSnapshotAsMarkdown(
    baseSnapshot({
      commonFoods: [{ name: "Rice | Beans combo", uses: 3, averageGrams: 200, averageCalories: 300, averageProteinG: 10 }],
    })
  );
  assert.match(markdown, /Rice \\\| Beans combo/);
  const foodLine = markdown.split("\n").find((line) => line.includes("Rice"));
  // The literal pipe is backslash-escaped, so a Markdown table renderer still
  // sees exactly 5 data columns even though the raw string contains 6 "|" characters.
  assert.equal(foodLine, "| Rice \\| Beans combo | 3 | 200 | 300 | 10 |");
});

test("a focus session id surfaces a note pointing at the workouts section", () => {
  const markdown = formatCoachSnapshotAsMarkdown(baseSnapshot({ focusSessionId: 11 }));
  assert.match(markdown, /specifically about workout #11/);
});
