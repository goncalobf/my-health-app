import { NextResponse } from "next/server";
import { and, asc, desc, eq, ne, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  sessions,
  sessionSets,
  routineExercises,
  exercises,
  trainingPlanState,
} from "@/db/schema";
import { getProgressionRecommendation } from "@/lib/progressive-overload";
import { requireAppUser } from "@/lib/app-user";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const sessionId = Number(id);

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Planned exercises from the routine (if any).
  const basePlan = session.routineId
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
          targetRirMin: routineExercises.targetRirMin,
          targetRirMax: routineExercises.targetRirMax,
          avoidFailure: routineExercises.avoidFailure,
          instruction: routineExercises.instruction,
          supersetGroup: routineExercises.supersetGroup,
          isAnchor: routineExercises.isAnchor,
          position: routineExercises.position,
        })
        .from(routineExercises)
        .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
        .where(eq(routineExercises.routineId, session.routineId))
        .orderBy(asc(routineExercises.position), asc(routineExercises.id))
    : [];
  const [planState] = await db
    .select({ isDeload: trainingPlanState.isDeload })
    .from(trainingPlanState)
    .where(eq(trainingPlanState.userId, user.id));
  const deloadMode = planState?.isDeload ?? false;
  const plan = deloadMode
    ? basePlan.map((item) => ({
        ...item,
        targetSets: Math.max(1, Math.ceil(item.targetSets / 2)),
        targetRirMin: 4,
        targetRirMax: 6,
        instruction: `Deload: use about 60% of your normal load and RIR 4+.${item.instruction ? ` ${item.instruction}` : ""}`,
        deloadMode: true,
      }))
    : basePlan.map((item) => ({ ...item, deloadMode: false }));

  // Sets already logged in this session.
  const loggedSets = await db
    .select({
      id: sessionSets.id,
      sessionId: sessionSets.sessionId,
      exerciseId: sessionSets.exerciseId,
      setNumber: sessionSets.setNumber,
      weightKg: sessionSets.weightKg,
      reps: sessionSets.reps,
      rir: sessionSets.rir,
      isWarmup: sessionSets.isWarmup,
      isDropSet: sessionSets.isDropSet,
      completedAt: sessionSets.completedAt,
      exerciseName: exercises.name,
      muscleGroup: exercises.muscleGroup,
      exerciseImageUrl: exercises.imageUrl,
    })
    .from(sessionSets)
    .innerJoin(exercises, eq(exercises.id, sessionSets.exerciseId))
    .where(eq(sessionSets.sessionId, sessionId))
    .orderBy(
      asc(sessionSets.exerciseId),
      asc(sessionSets.setNumber),
      asc(sessionSets.id)
    );

  // "Last time" reference: for each planned exercise (or any ad-hoc exercise
  // already logged), pull the sets from the most recent *other* session.
  const exerciseIds = new Set<number>([
    ...plan.map((p) => p.exerciseId),
    ...loggedSets.map((s) => s.exerciseId),
  ]);
  const lastSets: Record<number, { weightKg: number; reps: number; rir: number | null }[]> = {};
  const recommendations: Record<number, {
    action: "start" | "increase" | "repeat" | "reduce";
    weightKg: number | null;
    message: string;
    reason: string;
  }> = {};
  for (const exId of exerciseIds) {
    const historyRows = await db
      .select({
        sessionId: sessionSets.sessionId,
        weightKg: sessionSets.weightKg,
        reps: sessionSets.reps,
        rir: sessionSets.rir,
        startedAt: sessions.startedAt,
      })
      .from(sessionSets)
      .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
      .where(
        and(
          eq(sessionSets.exerciseId, exId),
          eq(sessions.userId, user.id),
          ne(sessionSets.sessionId, sessionId),
          isNotNull(sessions.finishedAt),
          isNotNull(sessionSets.completedAt),
          eq(sessionSets.isWarmup, false),
          eq(sessionSets.isDropSet, false)
        )
      )
      .orderBy(desc(sessions.startedAt), asc(sessionSets.setNumber));

    const grouped = new Map<number, { weightKg: number; reps: number; rir: number | null }[]>();
    for (const row of historyRows) {
      if (!grouped.has(row.sessionId) && grouped.size >= 2) continue;
      const group = grouped.get(row.sessionId) ?? [];
      group.push({ weightKg: row.weightKg, reps: row.reps, rir: row.rir });
      grouped.set(row.sessionId, group);
    }
    const history = [...grouped.values()];
    if (history[0]?.length) lastSets[exId] = history[0];

    const item = plan.find((p) => p.exerciseId === exId);
    if (!item) continue;
    if (deloadMode) {
      const workingWeight = history[0]?.length
        ? Math.max(...history[0].map((set) => set.weightKg))
        : null;
      const deloadWeight = workingWeight == null
        ? null
        : Math.round(workingWeight * 0.6 * 2) / 2;
      recommendations[exId] = {
        action: "reduce",
        weightKg: deloadWeight,
        message: deloadWeight == null
          ? "Use about 60% of your normal load"
          : `Deload at about ${deloadWeight}kg · RIR 4+`,
        reason: "This is a planned deload: half the normal sets, lower load and stay far from failure for one week.",
      };
      continue;
    }
    recommendations[exId] = getProgressionRecommendation(item, history);
  }

  return NextResponse.json({ session, plan, loggedSets, lastSets, recommendations });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
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
    .where(and(eq(sessions.id, Number(id)), eq(sessions.userId, user.id)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  await db.delete(sessions).where(and(eq(sessions.id, Number(id)), eq(sessions.userId, user.id)));
  return NextResponse.json({ ok: true });
}
