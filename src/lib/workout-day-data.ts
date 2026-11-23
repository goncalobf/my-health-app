import "server-only";
import { and, asc, desc, eq, exists, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activitySessions, exercises, routineExercises, routines, sessions, sessionSets,
  trainingCheckins, trainingPlanState, workoutDayChoices, workoutSchedule,
} from "@/db/schema";
import { dateISOInTimeZone, dayOfWeekISO, shiftISODate, startOfAppDay } from "./utils";
import type { WorkoutDay } from "./workout-day";

function availableRoutines(userId: number) {
  return db.select({ id: routines.id, name: routines.name, position: routines.position }).from(routines)
    .where(and(
      eq(routines.userId, userId),
      eq(routines.archived, false),
      exists(db.select({ id: routineExercises.id }).from(routineExercises)
        .where(eq(routineExercises.routineId, routines.id))),
    ));
}

export async function getWorkoutDayChoice(userId: number, day: string) {
  const available = availableRoutines(userId).as("available");
  const [choice] = await db
    .select({
      routineId: available.id,
      routineName: available.name,
      jiuJitsu: workoutDayChoices.jiuJitsu,
    })
    .from(workoutDayChoices)
    .leftJoin(available, eq(available.id, workoutDayChoices.routineId))
    .where(and(
      eq(workoutDayChoices.userId, userId),
      eq(workoutDayChoices.day, day),
      or(isNull(workoutDayChoices.routineId), isNotNull(available.id), eq(workoutDayChoices.jiuJitsu, true)),
    ));

  return choice ?? null;
}

export async function getWorkoutDay(userId: number, day: string): Promise<WorkoutDay> {
  const start = startOfAppDay(day);
  const end = startOfAppDay(shiftISODate(day, 1));
  const [available, choice, [scheduled], [latest], [completed]] = await Promise.all([
    availableRoutines(userId).orderBy(asc(routines.position), asc(routines.id)),
    getWorkoutDayChoice(userId, day),
    db.select({ routineId: workoutSchedule.routineId }).from(workoutSchedule)
      .where(and(eq(workoutSchedule.userId, userId), eq(workoutSchedule.dayOfWeek, dayOfWeekISO(day)))),
    db.select({ id: sessions.id, finishedAt: sessions.finishedAt }).from(sessions)
      .where(and(eq(sessions.userId, userId), gte(sessions.startedAt, start), lt(sessions.startedAt, end)))
      .orderBy(desc(sessions.startedAt), desc(sessions.id)).limit(1),
    db.select({ id: sessions.id }).from(sessions)
      .where(and(
        eq(sessions.userId, userId),
        isNotNull(sessions.finishedAt),
        gte(sessions.finishedAt, start),
        lt(sessions.finishedAt, end),
      )).limit(1),
  ]);
  return {
    day,
    routines: available.map(({ id, name }) => ({ id, name })),
    choice: choice ? { routineId: choice.routineId, jiuJitsu: choice.jiuJitsu } : null,
    defaultRoutineId: available.find((r) => r.id === scheduled?.routineId)?.id ?? null,
    activeSessionId: latest?.finishedAt === null ? latest.id : null,
    completedToday: !!completed,
  };
}

export async function getTrainingSuggestionContext(userId: number, plan: WorkoutDay) {
  const from = startOfAppDay(shiftISODate(plan.day, -13));
  const [slots, work, activities, [checkin], [state]] = await Promise.all([
    plan.routines.length
      ? db.select({
          routineId: routineExercises.routineId,
          muscleGroup: exercises.muscleGroup,
          muscleProfile: routineExercises.muscleProfile,
        }).from(routineExercises)
          .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
          .where(inArray(routineExercises.routineId, plan.routines.map(({ id }) => id)))
      : [],
    db.select({
      startedAt: sessions.startedAt,
      name: sessions.name,
      muscle: exercises.muscleGroup,
      sets: sql<number>`count(*)::int`,
    }).from(sessionSets)
      .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
      .innerJoin(exercises, eq(exercises.id, sessionSets.exerciseId))
      .where(and(
        eq(sessions.userId, userId),
        gte(sessions.startedAt, from),
        isNotNull(sessions.finishedAt),
        isNotNull(sessionSets.completedAt),
        eq(sessionSets.isWarmup, false),
        eq(sessionSets.isDropSet, false),
      ))
      .groupBy(sessions.startedAt, sessions.name, exercises.muscleGroup)
      .orderBy(desc(sessions.startedAt), asc(exercises.muscleGroup))
      .limit(100),
    db.select({
      startedAt: activitySessions.startedAt,
      type: activitySessions.type,
      durationSeconds: activitySessions.durationSeconds,
      effort: activitySessions.effort,
    }).from(activitySessions)
      .where(and(
        eq(activitySessions.userId, userId),
        gte(activitySessions.startedAt, from),
        isNotNull(activitySessions.finishedAt),
      ))
      .orderBy(desc(activitySessions.startedAt))
      .limit(30),
    db.select({
      day: trainingCheckins.day,
      sleepPoor: trainingCheckins.sleepPoor,
      appetiteLow: trainingCheckins.appetiteLow,
      jointPain: trainingCheckins.jointPain,
    }).from(trainingCheckins)
      .where(and(
        eq(trainingCheckins.userId, userId),
        gte(trainingCheckins.day, shiftISODate(plan.day, -6)),
      ))
      .orderBy(desc(trainingCheckins.day))
      .limit(1),
    db.select({ isDeload: trainingPlanState.isDeload }).from(trainingPlanState)
      .where(eq(trainingPlanState.userId, userId)),
  ]);

  return {
    routines: plan.routines.map((routine) => ({
      ...routine,
      muscles: [...new Set(slots.filter((slot) => slot.routineId === routine.id)
        .flatMap((slot) => slot.muscleProfile?.direct ?? (slot.muscleGroup ? [slot.muscleGroup] : [])))],
    })),
    work: work.map((row) => ({ ...row, day: dateISOInTimeZone(row.startedAt) })),
    activities: activities.map((row) => ({ ...row, day: dateISOInTimeZone(row.startedAt) })),
    checkin: checkin ?? null,
    isDeload: state?.isDeload ?? false,
  };
}
