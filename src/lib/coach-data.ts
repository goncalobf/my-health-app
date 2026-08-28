import { and, asc, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  bodyweightLogs,
  expenditureLogs,
  exercises,
  nutritionLogs,
  routineExercises,
  routines,
  sessionSets,
  sessions,
  settings,
  workoutSchedule,
} from "@/db/schema";
import {
  dateISOInTimeZone,
  shiftISODate,
  startOfAppDay,
  todayISO,
} from "@/lib/utils";

function isoDaysAgo(days: number) {
  return shiftISODate(todayISO(), -days);
}

export async function getCoachSnapshot({
  days = 28,
  sessionId,
}: { days?: number; sessionId?: number } = {}) {
  const fromDay = isoDaysAgo(days - 1);
  const fromTime = startOfAppDay(fromDay);

  const [setting] = await db.select().from(settings).where(eq(settings.id, 1));
  const [weights, expenditures, foods, sessionRows, setRows, schedule, routineTargets] =
    await Promise.all([
      db.select({ day: bodyweightLogs.day, weightKg: bodyweightLogs.weightKg })
        .from(bodyweightLogs).where(gte(bodyweightLogs.day, fromDay)).orderBy(asc(bodyweightLogs.day)),
      db.select({ day: expenditureLogs.day, totalCalories: expenditureLogs.totalCalories })
        .from(expenditureLogs).where(gte(expenditureLogs.day, fromDay)).orderBy(asc(expenditureLogs.day)),
      db.select({
        day: nutritionLogs.day, meal: nutritionLogs.meal, name: nutritionLogs.name,
        quantityG: nutritionLogs.quantityG, calories: nutritionLogs.calories,
        proteinG: nutritionLogs.proteinG, carbsG: nutritionLogs.carbsG, fatG: nutritionLogs.fatG,
      }).from(nutritionLogs).where(gte(nutritionLogs.day, fromDay)).orderBy(asc(nutritionLogs.day)),
      db.select({
        id: sessions.id, name: sessions.name, startedAt: sessions.startedAt,
        finishedAt: sessions.finishedAt, routineId: sessions.routineId,
      }).from(sessions).where(and(gte(sessions.startedAt, fromTime), isNotNull(sessions.finishedAt)))
        .orderBy(desc(sessions.startedAt)),
      db.select({
        sessionId: sessionSets.sessionId, exerciseId: sessionSets.exerciseId,
        exercise: exercises.name, muscleGroup: exercises.muscleGroup,
        weightKg: sessionSets.weightKg, reps: sessionSets.reps,
      }).from(sessionSets)
        .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
        .innerJoin(exercises, eq(exercises.id, sessionSets.exerciseId))
        .where(and(gte(sessions.startedAt, fromTime), isNotNull(sessions.finishedAt), isNotNull(sessionSets.completedAt), eq(sessionSets.isWarmup, false))),
      db.select({ dayOfWeek: workoutSchedule.dayOfWeek, routine: routines.name })
        .from(workoutSchedule).leftJoin(routines, eq(routines.id, workoutSchedule.routineId))
        .orderBy(asc(workoutSchedule.dayOfWeek)),
      db.select({
        routineId: routineExercises.routineId, exercise: exercises.name,
        minReps: routineExercises.minReps, maxReps: routineExercises.maxReps,
        targetSets: routineExercises.targetSets, incrementKg: routineExercises.weightIncrementKg,
      }).from(routineExercises).innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId)),
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
      const exerciseMap = new Map<string, { muscleGroup: string | null; sets: { weightKg: number; reps: number }[] }>();
      for (const set of sets) {
        const item = exerciseMap.get(set.exercise) ?? { muscleGroup: set.muscleGroup, sets: [] };
        item.sets.push({ weightKg: set.weightKg, reps: set.reps }); exerciseMap.set(set.exercise, item);
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

  return {
    generatedFor: today,
    focusSessionId: sessionId ?? null,
    periodDays: days,
    goal: setting?.goal ?? "recomposition",
    targetWeeklyChangePct: setting?.targetWeeklyChangePct ?? -0.25,
    goalWeightKg: setting?.goalWeightKg ?? null,
    targets,
    today: {
      nutrition: todayNutrition,
      remaining: {
        calories: Math.round(targets.calories - todayNutrition.calories),
        proteinG: Math.round(targets.proteinG - todayNutrition.proteinG),
        carbsG: Math.round(targets.carbsG - todayNutrition.carbsG),
        fatG: Math.round(targets.fatG - todayNutrition.fatG),
      },
      garminTotalCalories: expenditures.find((x) => x.day === today)?.totalCalories ?? null,
    },
    weightTrend: weights,
    expenditureTrend: expenditures,
    nutritionTrend: [...nutritionByDay].map(([day, totals]) => ({ day, ...totals })),
    workouts,
    schedule,
    routineTargets,
    commonFoods,
    dataCoverage: {
      weighIns: weights.length,
      garminDays: expenditures.length,
      nutritionDays: nutritionByDay.size,
      completedWorkouts: sessionRows.length,
    },
  };
}
