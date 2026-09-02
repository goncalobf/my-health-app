import { and, asc, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  activitySessions,
  bodyweightLogs,
  coachMemory,
  expenditureLogs,
  exercises,
  garminDailyMetrics,
  nutritionLogs,
  routineExercises,
  routines,
  sessionSets,
  sessions,
  settings,
  trainingCheckins,
  trainingPlanState,
  workoutSchedule,
} from "@/db/schema";
import {
  dateISOInTimeZone,
  shiftISODate,
  startOfAppDay,
  todayISO,
} from "@/lib/utils";
import { buildNutritionPhase } from "@/lib/nutrition-phase";
import { appendMemoryNote } from "@/lib/coach-memory";
import { calculateHydrationTarget } from "@/lib/hydration";

function isoDaysAgo(days: number) {
  return shiftISODate(todayISO(), -days);
}

export async function getCoachSnapshot({
  userId,
  days = 28,
  sessionId,
}: { userId: number; days?: number; sessionId?: number }) {
  const fromDay = isoDaysAgo(days - 1);
  const fromTime = startOfAppDay(fromDay);

  const [setting] = await db.select().from(settings).where(eq(settings.userId, userId));
  const [memoryRow] = await db.select({ notes: coachMemory.notes }).from(coachMemory).where(eq(coachMemory.userId, userId));
  const [weights, expenditures, foods, sessionRows, setRows, schedule, routineTargets, planStates, checkins, garminHealth, cardioRows] =
    await Promise.all([
      db.select({ day: bodyweightLogs.day, weightKg: bodyweightLogs.weightKg })
        .from(bodyweightLogs).where(and(eq(bodyweightLogs.userId, userId), gte(bodyweightLogs.day, fromDay))).orderBy(asc(bodyweightLogs.day)),
      db.select({ day: expenditureLogs.day, totalCalories: expenditureLogs.totalCalories })
        .from(expenditureLogs).where(and(eq(expenditureLogs.userId, userId), gte(expenditureLogs.day, fromDay))).orderBy(asc(expenditureLogs.day)),
      db.select({
        day: nutritionLogs.day, meal: nutritionLogs.meal, name: nutritionLogs.name,
        quantityG: nutritionLogs.quantityG, calories: nutritionLogs.calories,
        proteinG: nutritionLogs.proteinG, carbsG: nutritionLogs.carbsG, fatG: nutritionLogs.fatG,
      }).from(nutritionLogs).where(and(eq(nutritionLogs.userId, userId), gte(nutritionLogs.day, fromDay))).orderBy(asc(nutritionLogs.day)),
      db.select({
        id: sessions.id, name: sessions.name, startedAt: sessions.startedAt,
        finishedAt: sessions.finishedAt, routineId: sessions.routineId,
      }).from(sessions).where(and(eq(sessions.userId, userId), gte(sessions.startedAt, fromTime), isNotNull(sessions.finishedAt)))
        .orderBy(desc(sessions.startedAt)),
      db.select({
        sessionId: sessionSets.sessionId, exerciseId: sessionSets.exerciseId,
        exercise: exercises.name, muscleGroup: exercises.muscleGroup,
        weightKg: sessionSets.weightKg, reps: sessionSets.reps, rir: sessionSets.rir,
      }).from(sessionSets)
        .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
        .innerJoin(exercises, eq(exercises.id, sessionSets.exerciseId))
        .where(and(eq(sessions.userId, userId), gte(sessions.startedAt, fromTime), isNotNull(sessions.finishedAt), isNotNull(sessionSets.completedAt), eq(sessionSets.isWarmup, false), eq(sessionSets.isDropSet, false))),
      db.select({ dayOfWeek: workoutSchedule.dayOfWeek, routine: routines.name })
        .from(workoutSchedule).leftJoin(routines, eq(routines.id, workoutSchedule.routineId))
        .where(eq(workoutSchedule.userId, userId))
        .orderBy(asc(workoutSchedule.dayOfWeek)),
      db.select({
        routineId: routineExercises.routineId, exercise: exercises.name,
        minReps: routineExercises.minReps, maxReps: routineExercises.maxReps,
        targetSets: routineExercises.targetSets, incrementKg: routineExercises.weightIncrementKg,
        targetRirMin: routineExercises.targetRirMin,
        targetRirMax: routineExercises.targetRirMax,
        avoidFailure: routineExercises.avoidFailure,
        isAnchor: routineExercises.isAnchor,
        instruction: routineExercises.instruction,
      }).from(routineExercises)
        .innerJoin(routines, eq(routines.id, routineExercises.routineId))
        .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
        .where(eq(routines.userId, userId)),
      db.select().from(trainingPlanState).where(eq(trainingPlanState.userId, userId)).limit(1),
      db.select().from(trainingCheckins).where(eq(trainingCheckins.userId, userId)).orderBy(desc(trainingCheckins.day)).limit(1),
      db.select({
        date: garminDailyMetrics.date,
        restingHrBpm: garminDailyMetrics.restingHrBpm,
        hrvScore: garminDailyMetrics.hrvScore,
        hrvBalanceScore: garminDailyMetrics.hrvBalanceScore,
        sleepDurationSeconds: garminDailyMetrics.sleepDurationSeconds,
        sleepScoreValue: garminDailyMetrics.sleepScoreValue,
        caloriesActive: garminDailyMetrics.caloriesActive,
        caloriesTotal: garminDailyMetrics.caloriesTotal,
        steps: garminDailyMetrics.steps,
      }).from(garminDailyMetrics)
        .where(and(eq(garminDailyMetrics.userId, userId), gte(garminDailyMetrics.date, fromDay)))
        .orderBy(asc(garminDailyMetrics.date)),
      db.select({
        id: activitySessions.id,
        type: activitySessions.type,
        startedAt: activitySessions.startedAt,
        durationSeconds: activitySessions.durationSeconds,
        distanceM: activitySessions.distanceM,
        elevationM: activitySessions.elevationM,
        avgHeartRate: activitySessions.avgHeartRate,
        calories: activitySessions.calories,
        avgSpeedKmh: activitySessions.avgSpeedKmh,
        avgPowerW: activitySessions.avgPowerW,
        division: activitySessions.division,
      }).from(activitySessions)
        .where(and(eq(activitySessions.userId, userId), gte(activitySessions.startedAt, fromTime), isNotNull(activitySessions.finishedAt)))
        .orderBy(desc(activitySessions.startedAt)),
    ]);

  const nutritionByDay = new Map<string, { calories: number; proteinG: number; carbsG: number; fatG: number }>();
  const foodFrequency = new Map<string, { count: number; averageGrams: number; calories: number; proteinG: number }>();
  for (const food of foods) {
    const day = nutritionByDay.get(food.day) ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    day.calories += food.calories; day.proteinG += food.proteinG;
    day.carbsG += food.carbsG; day.fatG += food.fatG;
    nutritionByDay.set(food.day, day);
    const key = food.name.toLowerCase();
    const common = foodFrequency.get(key) ?? { count: 0, averageGrams: 0, calories: 0, proteinG: 0 };
    common.count += 1; common.averageGrams += food.quantityG;
    common.calories += food.calories; common.proteinG += food.proteinG;
    foodFrequency.set(key, common);
  }

  const setsBySession = new Map<number, typeof setRows>();
  for (const set of setRows) setsBySession.set(set.sessionId, [...(setsBySession.get(set.sessionId) ?? []), set]);
  const workouts = sessionRows.map((session) => {
      const sets = setsBySession.get(session.id) ?? [];
      const exerciseMap = new Map<string, { muscleGroup: string | null; sets: { weightKg: number; reps: number; rir: number | null }[] }>();
      for (const set of sets) {
        const item = exerciseMap.get(set.exercise) ?? { muscleGroup: set.muscleGroup, sets: [] };
        item.sets.push({ weightKg: set.weightKg, reps: set.reps, rir: set.rir }); exerciseMap.set(set.exercise, item);
      }
      return {
        id: session.id,
        date: dateISOInTimeZone(session.startedAt),
        name: session.name,
        durationMinutes: session.finishedAt ? Math.round((session.finishedAt.getTime() - session.startedAt.getTime()) / 60_000) : null,
        volumeKg: Math.round(sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0)),
        exercises: [...exerciseMap].map(([name, value]) => ({ name, ...value })),
      };
    });

  const today = todayISO();
  const todayNutrition = nutritionByDay.get(today) ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const targets = {
    calories: setting?.targetCalories ?? 2200,
    proteinG: setting?.targetProteinG ?? 160,
    carbsG: setting?.targetCarbsG ?? 220,
    fatG: setting?.targetFatG ?? 70,
  };
  const commonFoods = [...foodFrequency.entries()]
    .sort((a, b) => b[1].count - a[1].count).slice(0, 15)
    .map(([name, value]) => ({
      name, uses: value.count, averageGrams: Math.round(value.averageGrams / value.count),
      averageCalories: Math.round(value.calories / value.count),
      averageProteinG: Math.round(value.proteinG / value.count),
    }));

  const effectiveWeightKg =
    setting?.currentWeightKg ?? weights[weights.length - 1]?.weightKg ?? null;
  const creatineLoading = setting?.creatineLoading ?? false;

  return {
    generatedFor: today,
    focusSessionId: sessionId ?? null,
    periodDays: days,
    goal: setting?.goal ?? "recomposition",
    targetWeeklyChangePct: setting?.targetWeeklyChangePct ?? -0.25,
    goalWeightKg: setting?.goalWeightKg ?? null,
    profile: {
      currentWeightKg: effectiveWeightKg,
      goalWeightKg: setting?.goalWeightKg ?? null,
      heightCm: setting?.heightCm ?? null,
      ageYears: setting?.ageYears ?? null,
      biologicalSex: setting?.biologicalSex ?? "unspecified",
    },
    targets,
    hydration: {
      creatineLoading,
      ...(effectiveWeightKg
        ? calculateHydrationTarget({ weightKg: effectiveWeightKg, creatineLoading })
        : { baselineLiters: null, creatineBonusLiters: null, targetLiters: null }),
    },
    today: {
      nutrition: todayNutrition,
      remaining: {
        calories: Math.round(targets.calories - todayNutrition.calories),
        proteinG: Math.round(targets.proteinG - todayNutrition.proteinG),
        carbsG: Math.round(targets.carbsG - todayNutrition.carbsG),
        fatG: Math.round(targets.fatG - todayNutrition.fatG),
      },
      garminTotalCalories: expenditures.find((x) => x.day === today)?.totalCalories ?? null,
      garminHealth: garminHealth.find((x) => x.date === today) ?? null,
    },
    garminHealthTrend: garminHealth,
    cardioSessions: cardioRows.map((s) => ({
      type: s.type,
      date: s.startedAt.toISOString().slice(0, 10),
      durationMinutes: s.durationSeconds ? Math.round(s.durationSeconds / 60) : null,
      distanceKm: s.distanceM ? Math.round(s.distanceM / 10) / 100 : null,
      elevationM: s.elevationM,
      avgHeartRate: s.avgHeartRate,
      calories: s.calories,
      avgSpeedKmh: s.avgSpeedKmh,
      avgPowerW: s.avgPowerW,
      division: s.division,
    })),
    weightTrend: weights,
    expenditureTrend: expenditures,
    nutritionTrend: [...nutritionByDay].map(([day, totals]) => ({ day, ...totals })),
    workouts,
    schedule,
    routineTargets,
    trainingPlan: {
      state: planStates[0] ?? null,
      latestRecoveryCheckin: checkins[0] ?? null,
    },
    commonFoods,
    coachMemory: memoryRow?.notes ?? [],
    nutritionPhase: buildNutritionPhase({
      goal: setting?.goal ?? "recomposition",
      startedOn: setting?.goalStartedOn ?? null,
      today,
      targetWeeklyChangePct: setting?.targetWeeklyChangePct ?? -0.25,
      weights,
    }),
    dataCoverage: {
      weighIns: weights.length,
      garminExpendityureDays: expenditures.length,
      garminHealthDays: garminHealth.length,
      nutritionDays: nutritionByDay.size,
      completedWorkouts: sessionRows.length,
      cardioSessions: cardioRows.length,
    },
  };
}

export type CoachSnapshot = Awaited<ReturnType<typeof getCoachSnapshot>>;

/** Appends a coach-authored memory note for one user, capped and trimmed. No-op for an empty/whitespace note. */
export async function saveCoachMemoryNote(userId: number, note: string | null | undefined) {
  if (!note || !note.trim()) return;
  const [existing] = await db.select({ notes: coachMemory.notes }).from(coachMemory).where(eq(coachMemory.userId, userId));
  const next = appendMemoryNote(existing?.notes ?? [], note);
  await db
    .insert(coachMemory)
    .values({ userId, notes: next })
    .onConflictDoUpdate({ target: coachMemory.userId, set: { notes: next, updatedAt: new Date() } });
}
