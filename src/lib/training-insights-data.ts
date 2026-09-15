import "server-only";
import { and, asc, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  routines,
  sessions,
  sessionSets,
  exercises,
  workoutSchedule,
} from "@/db/schema";
import { getRoutinePrescription } from "./workout-plan-data";
import { comparableHistory } from "./workout-history";
import {
  getProgressionRecommendation,
  completeStraightSets,
  plannedSets,
} from "./progressive-overload";
import { findDecliningAnchors } from "./training-plan";
import { muscleVolume, nextRoutineInSequence } from "./training-volume";
import { shiftISODate, todayISO, startOfAppDay } from "./utils";
export async function getTrainingInsights(userId: number) {
  const routineRows = await db
    .select()
    .from(routines)
    .where(and(eq(routines.userId, userId), eq(routines.archived, false)))
    .orderBy(asc(routines.position), asc(routines.id));
  const plans = await Promise.all(
    routineRows.map(async (r) => ({
      ...r,
      plan: await getRoutinePrescription(userId, r.id),
    })),
  );
  const rows = await db
    .select({
      sessionId: sessionSets.sessionId,
      exerciseId: sessionSets.exerciseId,
      setNumber: sessionSets.setNumber,
      weightKg: sessionSets.weightKg,
      reps: sessionSets.reps,
      rir: sessionSets.rir,
      startedAt: sessions.startedAt,
      prescriptionSnapshot: sessions.prescriptionSnapshot,
      performanceContext: sessions.performanceContext,
      muscleGroup: exercises.muscleGroup,
    })
    .from(sessionSets)
    .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
    .innerJoin(exercises, eq(exercises.id, sessionSets.exerciseId))
    .where(
      and(
        eq(sessions.userId, userId),
        gte(sessions.startedAt, startOfAppDay(shiftISODate(todayISO(), -89))),
        isNotNull(sessions.finishedAt),
        isNotNull(sessionSets.completedAt),
        eq(sessionSets.isWarmup, false),
        eq(sessionSets.isDropSet, false),
      ),
    )
    .orderBy(desc(sessions.startedAt), asc(sessionSets.setNumber));
  const anchors: Record<
    string,
    { weightKg: number; totalReps: number; setCount: number }[]
  > = {};
  const recommendations = plans.flatMap((r) =>
    r.plan.map((p) => {
      const history = comparableHistory(p, rows);
      if (p.isAnchor)
        anchors[`${r.name} · ${p.name} (#${p.slotId})`] = history
          .filter(
            (h) =>
              completeStraightSets(p, h.sets) &&
              plannedSets(p, h.sets).every(
                (s) =>
                  s.rir != null &&
                  p.targetRirMin != null &&
                  s.rir >= p.targetRirMin &&
                  s.rir <= (p.targetRirMax ?? p.targetRirMin),
              ),
          )
          .map((h) => {
            const sets = plannedSets(p, h.sets);
            return {
              weightKg: sets[0].weightKg,
              totalReps: sets.reduce((n, s) => n + s.reps, 0),
              setCount: sets.length,
            };
          });
      return {
        routineId: r.id,
        routineName: r.name,
        exerciseId: p.exerciseId,
        exerciseName: p.name,
        ...getProgressionRecommendation(
          p,
          history.map((h) => h.sets),
        ),
        comparableSessions: history.length,
      };
    }),
  );
  const schedule = await db
    .select()
    .from(workoutSchedule)
    .where(eq(workoutSchedule.userId, userId));
  const scheduled = plans.flatMap((r) =>
    Array(schedule.filter((s) => s.routineId === r.id).length)
      .fill(r.plan)
      .flat(),
  );
  const weeklyPlans = schedule.length
    ? scheduled
    : plans.flatMap((r) => r.plan);
  const planned = weeklyPlans.map((p) => ({
    sets: p.targetSets,
    muscleGroup: p.muscleGroup,
    muscleProfile: p.muscleProfile,
  }));
  const completed = (days: number) =>
    rows
      .filter(
        (r) => r.startedAt >= startOfAppDay(shiftISODate(todayISO(), 1 - days)),
      )
      .map((r) => ({
        sets: 1,
        muscleGroup: r.muscleGroup,
        muscleProfile:
          r.prescriptionSnapshot?.plan.find(
            (p) => p.exerciseId === r.exerciseId,
          )?.muscleProfile ?? null,
      }));
  const [latest] = await db
    .select({ routineId: sessions.routineId })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNotNull(sessions.finishedAt)))
    .orderBy(desc(sessions.startedAt))
    .limit(1);
  return {
    routines: plans,
    decliningAnchors: findDecliningAnchors(anchors),
    recommendations,
    volume: {
      basis: schedule.length
        ? "Current weekly schedule"
        : "One pass through your routines",
      last7Days: muscleVolume(planned, completed(7)),
      last28Days: muscleVolume([], completed(28)),
    },
    nextRoutine: nextRoutineInSequence(
      routineRows.filter((r) => plans.find((p) => p.id === r.id)?.plan.length),
      latest?.routineId ?? null,
    ),
  };
}
