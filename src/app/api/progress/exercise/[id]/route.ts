import { NextResponse } from "next/server";
import { and, asc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { sessionSets, sessions, exercises } from "@/db/schema";
import { est1RM } from "@/lib/utils";
import { requireAppUser } from "@/lib/app-user";

// Per-session best estimated 1RM for one exercise, oldest first (for charting).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const exerciseId = Number(id);

  const [ex] = await db
    .select({ name: exercises.name })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), or(isNull(exercises.ownerUserId), eq(exercises.ownerUserId, user.id))));

  if (!ex) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db
    .select({
      sessionId: sessionSets.sessionId,
      startedAt: sessions.startedAt,
      weightKg: sessionSets.weightKg,
      reps: sessionSets.reps,
    })
    .from(sessionSets)
    .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
    .where(
      and(
        eq(sessionSets.exerciseId, exerciseId),
        eq(sessions.userId, user.id),
        eq(sessionSets.isWarmup, false),
        eq(sessionSets.isDropSet, false),
        gt(sessionSets.reps, 0),
        gt(sessionSets.weightKg, 0),
        isNotNull(sessionSets.completedAt)
      )
    )
    .orderBy(asc(sessions.startedAt));

  const bySession = new Map<
    number,
    { date: string; est1RM: number; topWeightKg: number }
  >();
  for (const r of rows) {
    const e1 = est1RM(r.weightKg, r.reps);
    const date = new Date(r.startedAt).toISOString().slice(0, 10);
    const cur = bySession.get(r.sessionId);
    if (!cur) {
      bySession.set(r.sessionId, {
        date,
        est1RM: e1,
        topWeightKg: r.weightKg,
      });
    } else {
      cur.est1RM = Math.max(cur.est1RM, e1);
      cur.topWeightKg = Math.max(cur.topWeightKg, r.weightKg);
    }
  }

  return NextResponse.json({
    name: ex.name,
    points: [...bySession.values()],
  });
}
