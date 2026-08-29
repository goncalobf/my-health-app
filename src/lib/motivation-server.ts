import "server-only";
import { and, asc, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, sessionSets, exercises } from "@/db/schema";
import type { MotivationInput } from "@/lib/motivation-facts";
import { shiftISODate, startOfAppDay, todayISO } from "@/lib/utils";

/**
 * Gathers the numbers the motivation copy is allowed to quote back. Working
 * sets only: warmups and drops are not progress.
 */
export async function getMotivationInput(
  userId: number
): Promise<MotivationInput> {
  const today = todayISO();
  const weekStart = startOfAppDay(shiftISODate(today, -6));
  const previousWeekStart = startOfAppDay(shiftISODate(today, -13));

  const workingSet = and(
    eq(sessions.userId, userId),
    isNotNull(sessions.finishedAt),
    isNotNull(sessionSets.completedAt),
    eq(sessionSets.isWarmup, false),
    eq(sessionSets.isDropSet, false)
  );

  const [[last], [totals], [thisWeek], [previousWeek], volumeRows, liftRows] =
    await Promise.all([
      db
        .select({ finishedAt: sessions.finishedAt })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), isNotNull(sessions.finishedAt)))
        .orderBy(desc(sessions.finishedAt))
        .limit(1),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), isNotNull(sessions.finishedAt))),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, userId),
            isNotNull(sessions.finishedAt),
            gte(sessions.finishedAt, weekStart)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, userId),
            isNotNull(sessions.finishedAt),
            gte(sessions.finishedAt, previousWeekStart),
            lt(sessions.finishedAt, weekStart)
          )
        ),
      db
        .select({
          finishedAt: sessions.finishedAt,
          weightKg: sessionSets.weightKg,
          reps: sessionSets.reps,
        })
        .from(sessionSets)
        .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
        .where(and(workingSet, gte(sessions.finishedAt, previousWeekStart))),
      db
        .select({
          name: exercises.name,
          weightKg: sessionSets.weightKg,
          startedAt: sessions.startedAt,
        })
        .from(sessionSets)
        .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
        .innerJoin(exercises, eq(exercises.id, sessionSets.exerciseId))
        .where(workingSet)
        .orderBy(asc(sessions.startedAt)),
    ]);

  let volumeThisWeekKg = 0;
  let volumePreviousWeekKg = 0;
  for (const row of volumeRows) {
    if (!row.finishedAt) continue;
    const volume = row.weightKg * row.reps;
    if (row.finishedAt >= weekStart) volumeThisWeekKg += volume;
    else volumePreviousWeekKg += volume;
  }

  // Biggest gain between an exercise's earliest and heaviest working weight.
  const firstSeen = new Map<string, number>();
  const heaviest = new Map<string, number>();
  for (const row of liftRows) {
    if (row.weightKg <= 0) continue;
    if (!firstSeen.has(row.name)) firstSeen.set(row.name, row.weightKg);
    heaviest.set(row.name, Math.max(heaviest.get(row.name) ?? 0, row.weightKg));
  }
  let bestLift: MotivationInput["bestLift"] = null;
  for (const [name, start] of firstSeen) {
    const gainKg = (heaviest.get(name) ?? start) - start;
    if (gainKg > 0 && (!bestLift || gainKg > bestLift.gainKg)) {
      bestLift = { name, gainKg };
    }
  }

  const daysSinceLastWorkout = last?.finishedAt
    ? Math.max(
        0,
        Math.floor(
          (startOfAppDay(today).getTime() -
            startOfAppDay(
              new Date(last.finishedAt).toISOString().slice(0, 10)
            ).getTime()) /
            86_400_000
        )
      )
    : null;

  return {
    daysSinceLastWorkout,
    workoutsThisWeek: thisWeek?.count ?? 0,
    workoutsPreviousWeek: previousWeek?.count ?? 0,
    volumeThisWeekKg,
    volumePreviousWeekKg,
    bestLift,
    totalWorkouts: totals?.count ?? 0,
  };
}
