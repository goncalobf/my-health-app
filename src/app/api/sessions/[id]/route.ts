import { NextResponse } from "next/server";
import { and, asc, desc, eq, ne, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  sessions,
  sessionSets,
  routineExercises,
  exercises,
} from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = Number(id);

  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Planned exercises from the routine (if any).
  const plan = session.routineId
    ? await db
        .select({
          exerciseId: routineExercises.exerciseId,
          name: exercises.name,
          muscleGroup: exercises.muscleGroup,
          targetSets: routineExercises.targetSets,
          targetReps: routineExercises.targetReps,
          targetWeightKg: routineExercises.targetWeightKg,
          restSeconds: routineExercises.restSeconds,
          position: routineExercises.position,
        })
        .from(routineExercises)
        .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
        .where(eq(routineExercises.routineId, session.routineId))
        .orderBy(asc(routineExercises.position), asc(routineExercises.id))
    : [];

  // Sets already logged in this session.
  const loggedSets = await db
    .select()
    .from(sessionSets)
    .where(eq(sessionSets.sessionId, sessionId))
    .orderBy(asc(sessionSets.exerciseId), asc(sessionSets.setNumber));

  // "Last time" reference: for each planned exercise (or any ad-hoc exercise
  // already logged), pull the sets from the most recent *other* session.
  const exerciseIds = new Set<number>([
    ...plan.map((p) => p.exerciseId),
    ...loggedSets.map((s) => s.exerciseId),
  ]);
  const lastSets: Record<number, { weightKg: number; reps: number }[]> = {};
  for (const exId of exerciseIds) {
    const [prev] = await db
      .select({ sessionId: sessionSets.sessionId })
      .from(sessionSets)
      .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
      .where(
        and(
          eq(sessionSets.exerciseId, exId),
          ne(sessionSets.sessionId, sessionId),
          isNotNull(sessions.finishedAt)
        )
      )
      .orderBy(desc(sessions.startedAt))
      .limit(1);
    if (prev) {
      const sets = await db
        .select({ weightKg: sessionSets.weightKg, reps: sessionSets.reps })
        .from(sessionSets)
        .where(
          and(
            eq(sessionSets.sessionId, prev.sessionId),
            eq(sessionSets.exerciseId, exId),
            eq(sessionSets.isWarmup, false)
          )
        )
        .orderBy(asc(sessionSets.setNumber));
      if (sets.length) lastSets[exId] = sets;
    }
  }

  return NextResponse.json({ session, plan, loggedSets, lastSets });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = {};
  if (body.name !== undefined) set.name = String(body.name);
  if (body.notes !== undefined)
    set.notes = body.notes ? String(body.notes) : null;
  if (body.finish === true) set.finishedAt = new Date();
  if (body.finish === false) set.finishedAt = null;

  const [row] = await db
    .update(sessions)
    .set(set)
    .where(eq(sessions.id, Number(id)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(sessions).where(eq(sessions.id, Number(id)));
  return NextResponse.json({ ok: true });
}
