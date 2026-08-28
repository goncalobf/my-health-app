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
          imageUrl: exercises.imageUrl,
          targetSets: routineExercises.targetSets,
          targetReps: routineExercises.targetReps,
          minReps: routineExercises.minReps,
          maxReps: routineExercises.maxReps,
          targetWeightKg: routineExercises.targetWeightKg,
          weightIncrementKg: routineExercises.weightIncrementKg,
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
    .select({
      id: sessionSets.id,
      sessionId: sessionSets.sessionId,
      exerciseId: sessionSets.exerciseId,
      setNumber: sessionSets.setNumber,
      weightKg: sessionSets.weightKg,
      reps: sessionSets.reps,
      isWarmup: sessionSets.isWarmup,
      completedAt: sessionSets.completedAt,
      exerciseName: exercises.name,
      muscleGroup: exercises.muscleGroup,
      exerciseImageUrl: exercises.imageUrl,
    })
    .from(sessionSets)
    .innerJoin(exercises, eq(exercises.id, sessionSets.exerciseId))
    .where(eq(sessionSets.sessionId, sessionId))
    .orderBy(asc(sessionSets.exerciseId), asc(sessionSets.setNumber));

  // "Last time" reference: for each planned exercise (or any ad-hoc exercise
  // already logged), pull the sets from the most recent *other* session.
  const exerciseIds = new Set<number>([
    ...plan.map((p) => p.exerciseId),
    ...loggedSets.map((s) => s.exerciseId),
  ]);
  const lastSets: Record<number, { weightKg: number; reps: number }[]> = {};
  const recommendations: Record<number, {
    action: "start" | "increase" | "repeat" | "reduce";
    weightKg: number | null;
    message: string;
  }> = {};
  for (const exId of exerciseIds) {
    const historyRows = await db
      .select({
        sessionId: sessionSets.sessionId,
        weightKg: sessionSets.weightKg,
        reps: sessionSets.reps,
        startedAt: sessions.startedAt,
      })
      .from(sessionSets)
      .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
      .where(
        and(
          eq(sessionSets.exerciseId, exId),
          ne(sessionSets.sessionId, sessionId),
          isNotNull(sessions.finishedAt),
          isNotNull(sessionSets.completedAt),
          eq(sessionSets.isWarmup, false)
        )
      )
      .orderBy(desc(sessions.startedAt), asc(sessionSets.setNumber));

    const grouped = new Map<number, { weightKg: number; reps: number }[]>();
    for (const row of historyRows) {
      if (!grouped.has(row.sessionId) && grouped.size >= 2) continue;
      const group = grouped.get(row.sessionId) ?? [];
      group.push({ weightKg: row.weightKg, reps: row.reps });
      grouped.set(row.sessionId, group);
    }
    const history = [...grouped.values()];
    if (history[0]?.length) lastSets[exId] = history[0];

    const item = plan.find((p) => p.exerciseId === exId);
    if (!item || !history[0]?.length) {
      recommendations[exId] = {
        action: "start",
        weightKg: item?.targetWeightKg ?? null,
        message: item?.targetWeightKg ? `Start at ${item.targetWeightKg}kg` : "Choose a comfortable starting weight",
      };
      continue;
    }
    const latest = history[0];
    const workingWeight = Math.max(...latest.map((s) => s.weightKg));
    const enoughSets = latest.length >= item.targetSets;
    const hitTop = enoughSets && latest.every((s) => s.reps >= item.maxReps);
    const missedTwice = history.length >= 2 && history.slice(0, 2).every((sets) => sets.some((s) => s.reps < item.minReps));
    if (hitTop) {
      const next = Math.round((workingWeight + item.weightIncrementKg) * 10) / 10;
      recommendations[exId] = { action: "increase", weightKg: next, message: `Progress to ${next}kg · aim for ${item.minReps}–${item.maxReps} reps` };
    } else if (missedTwice) {
      const next = Math.max(0, Math.round((workingWeight - item.weightIncrementKg) * 10) / 10);
      recommendations[exId] = { action: "reduce", weightKg: next, message: `Deload to ${next}kg after two difficult sessions` };
    } else {
      recommendations[exId] = { action: "repeat", weightKg: workingWeight, message: `Repeat ${workingWeight}kg · build toward ${item.maxReps} reps` };
    }
  }

  return NextResponse.json({ session, plan, loggedSets, lastSets, recommendations });
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
