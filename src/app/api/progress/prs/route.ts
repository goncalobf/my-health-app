import { NextResponse } from "next/server";
import { and, eq, gt, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { sessionSets, exercises, sessions } from "@/db/schema";
import { est1RM } from "@/lib/utils";

// Best set per exercise, ranked by estimated 1RM.
export async function GET() {
  const rows = await db
    .select({
      exerciseId: sessionSets.exerciseId,
      name: exercises.name,
      weightKg: sessionSets.weightKg,
      reps: sessionSets.reps,
      startedAt: sessions.startedAt,
    })
    .from(sessionSets)
    .innerJoin(exercises, eq(exercises.id, sessionSets.exerciseId))
    .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
    .where(
      and(
        eq(sessionSets.isWarmup, false),
        gt(sessionSets.reps, 0),
        gt(sessionSets.weightKg, 0),
        isNotNull(sessionSets.completedAt)
      )
    );

  const best = new Map<
    number,
    {
      exerciseId: number;
      name: string;
      bestWeightKg: number;
      bestReps: number;
      est1RM: number;
      date: Date;
    }
  >();

  for (const r of rows) {
    const e1 = est1RM(r.weightKg, r.reps);
    const cur = best.get(r.exerciseId);
    if (!cur || e1 > cur.est1RM) {
      best.set(r.exerciseId, {
        exerciseId: r.exerciseId,
        name: r.name,
        bestWeightKg: r.weightKg,
        bestReps: r.reps,
        est1RM: e1,
        date: r.startedAt,
      });
    }
  }

  const result = [...best.values()].sort((a, b) => b.est1RM - a.est1RM);
  return NextResponse.json(result);
}
