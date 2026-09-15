import { NextResponse } from "next/server";
import { and, asc, desc, eq, lt, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { sessions, sessionSets, exercises } from "@/db/schema";
import {
  getProgressionRecommendation,
  type ProgressionRecommendation,
} from "@/lib/progressive-overload";
import { applySessionExerciseOrder } from "@/lib/workout-flow";
import { requireAppUser } from "@/lib/app-user";
import { getRoutinePrescription } from "@/lib/workout-plan-data";
import { effectivePlan } from "@/lib/training-prescription";
import { comparableHistory } from "@/lib/workout-history";
import { sessionPatch } from "@/lib/training-validation";
import {
  est1RM,
  dateISOInTimeZone,
  startOfAppDay,
  shiftISODate,
} from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAppUser();
  const { id } = await params;
  if (
    ![Number(id)].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 2147483647,
    )
  )
    return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
  const sessionId = Number(id);
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
  if (!session)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const snapshot = session.prescriptionSnapshot;
  const basePlan =
    snapshot?.plan ??
    (!session.finishedAt && session.routineId
      ? await getRoutinePrescription(user.id, session.routineId)
      : []);
  const plan = applySessionExerciseOrder(
    effectivePlan(snapshot ?? { version: 1, isDeload: false, plan: basePlan }),
    session.exerciseOrder,
  );
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
    .orderBy(asc(sessionSets.setNumber), asc(sessionSets.id));
  // Only prior completed sessions. Every personal history read is owner scoped.
  const historyRows = await db
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
    })
    .from(sessionSets)
    .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
    .where(
      and(
        eq(sessions.userId, user.id),
        lt(sessions.startedAt, session.startedAt),
        isNotNull(sessions.finishedAt),
        isNotNull(sessionSets.completedAt),
        eq(sessionSets.isWarmup, false),
        eq(sessionSets.isDropSet, false),
      ),
    )
    .orderBy(desc(sessions.startedAt), asc(sessionSets.setNumber));
  const lastSets: Record<
    number,
    {
      weightKg: number;
      reps: number;
      rir?: number | null;
      setNumber?: number;
    }[]
  > = {};
  const recommendations: Record<
    number,
    ProgressionRecommendation & {
      sources: { sessionId: number; startedAt: Date }[];
    }
  > = {};
  const priorBest: Record<number, number> = {};
  for (const item of basePlan) {
    const all = comparableHistory(item, historyRows, Infinity);
    if (all[0]) lastSets[item.exerciseId] = all[0].sets;
    if (
      all.length &&
      session.performanceContext === "normal" &&
      snapshot &&
      !snapshot.isDeload &&
      !["assistance", "bodyweight"].includes(
        item.equipmentProfile?.loading ?? "total",
      )
    )
      priorBest[item.exerciseId] = Math.max(
        ...all.flatMap((h) => h.sets.map((s) => est1RM(s.weightKg, s.reps))),
      );
    const cutoff = startOfAppDay(
      shiftISODate(dateISOInTimeZone(session.startedAt), -89),
    );
    const recent = all.filter((h) => h.startedAt >= cutoff).slice(0, 3);
    const current = loggedSets.filter(
      (s) =>
        s.exerciseId === item.exerciseId &&
        s.completedAt &&
        !s.isWarmup &&
        !s.isDropSet,
    );
    // A completed summary offers the NEXT exposure's targets, including this workout.
    if (
      session.finishedAt &&
      snapshot &&
      !snapshot.isDeload &&
      session.performanceContext === "normal" &&
      current.length
    )
      recent.unshift({
        sessionId,
        startedAt: session.startedAt,
        sets: current,
      });
    let recommendation = getProgressionRecommendation(
      item,
      recent.map((h) => h.sets),
    );
    if (!snapshot)
      recommendation = {
        action: "repeat",
        weightKg: null,
        message: "Historical prescription unknown",
        reason:
          "This workout predates saved prescriptions. Keep it as history; start a new workout to establish a comparable baseline.",
      };
    else if (snapshot.isDeload)
      recommendation = {
        action: "repeat",
        weightKg: null,
        message: "Deload · choose a comfortable load at 4+ RIR",
        reason:
          "Use fewer sets and stop well short of failure. This workout will not reset your normal progression baseline.",
      };
    recommendations[item.exerciseId] = {
      ...recommendation,
      sources: recent
        .slice(0, 3)
        .map((h) => ({ sessionId: h.sessionId, startedAt: h.startedAt })),
    };
  }
  return NextResponse.json({
    session,
    plan,
    loggedSets,
    lastSets,
    recommendations,
    priorBest,
    legacyPrescription: !snapshot,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAppUser();
  const { id } = await params;
  if (
    ![Number(id)].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 2147483647,
    )
  )
    return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
  const [owned] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, Number(id)), eq(sessions.userId, user.id)));
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = sessionPatch.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid workout update" },
      { status: 400 },
    );
  const { finish, skipSet, ...fields } = parsed.data;
  const set: Record<string, unknown> = { ...fields };
  if (finish !== undefined) set.finishedAt = finish ? new Date() : null;
  if (skipSet) {
    if (owned.finishedAt)
      return NextResponse.json(
        { error: "Cannot skip sets in a finished workout" },
        { status: 400 },
      );
    const [exercise] = await db
      .select({ id: exercises.id })
      .from(exercises)
      .where(
        and(
          eq(exercises.id, skipSet.exerciseId),
          sql`(${exercises.ownerUserId} is null or ${exercises.ownerUserId} = ${user.id})`,
        ),
      );
    if (!exercise)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    set.skippedSets = sql`${sessions.skippedSets} || ${JSON.stringify([skipSet])}::jsonb`;
  }
  if (!Object.keys(set).length)
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  const [row] = await db
    .update(sessions)
    .set(set)
    .where(and(eq(sessions.id, Number(id)), eq(sessions.userId, user.id)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAppUser();
  const { id } = await params;
  if (
    ![Number(id)].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 2147483647,
    )
  )
    return NextResponse.json({ error: "Invalid identifier" }, { status: 400 });
  await db
    .delete(sessions)
    .where(and(eq(sessions.id, Number(id)), eq(sessions.userId, user.id)));
  return NextResponse.json({ ok: true });
}
