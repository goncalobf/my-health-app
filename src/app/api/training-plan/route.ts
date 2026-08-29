import { NextResponse } from "next/server";
import { and, asc, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  exercises,
  routineExercises,
  routines,
  sessionSets,
  sessions,
  trainingCheckins,
  trainingPlanState,
} from "@/db/schema";
import { shiftISODate, todayISO } from "@/lib/utils";
import { buildTrainingPlanStatus, findDecliningAnchors } from "@/lib/training-plan";
import { requireAppUser } from "@/lib/app-user";

async function ensureState(userId: number) {
  await db
    .insert(trainingPlanState)
    .values({ userId, planName: "My training plan", blockStartedOn: todayISO() })
    .onConflictDoNothing({ target: trainingPlanState.userId });
}

export async function GET() {
  const user = await requireAppUser();
  await ensureState(user.id);
  const [state] = await db
    .select()
    .from(trainingPlanState)
    .where(eq(trainingPlanState.userId, user.id));
  const [latestCheckin] = await db
    .select()
    .from(trainingCheckins)
    .where(and(eq(trainingCheckins.userId, user.id), gte(trainingCheckins.day, shiftISODate(todayISO(), -6))))
    .orderBy(desc(trainingCheckins.day), desc(trainingCheckins.id))
    .limit(1);
  const routineRows = await db
    .select({
      routineId: routines.id,
      routineName: routines.name,
      routinePosition: routines.position,
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      exercisePosition: routineExercises.position,
      targetSets: routineExercises.targetSets,
      minReps: routineExercises.minReps,
      maxReps: routineExercises.maxReps,
      targetRirMin: routineExercises.targetRirMin,
      targetRirMax: routineExercises.targetRirMax,
      avoidFailure: routineExercises.avoidFailure,
      instruction: routineExercises.instruction,
      supersetGroup: routineExercises.supersetGroup,
      isAnchor: routineExercises.isAnchor,
    })
    .from(routines)
    .innerJoin(routineExercises, eq(routineExercises.routineId, routines.id))
    .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
    .where(and(eq(routines.userId, user.id), eq(routines.archived, false)))
    .orderBy(asc(routines.position), asc(routineExercises.position));

  const anchorIds = [
    ...new Set(
      routineRows.filter((row) => row.isAnchor).map((row) => row.exerciseId)
    ),
  ];
  const anchorSets = anchorIds.length
    ? await db
        .select({
          exerciseId: sessionSets.exerciseId,
          exerciseName: exercises.name,
          sessionId: sessionSets.sessionId,
          startedAt: sessions.startedAt,
          weightKg: sessionSets.weightKg,
          reps: sessionSets.reps,
        })
        .from(sessionSets)
        .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
        .innerJoin(exercises, eq(exercises.id, sessionSets.exerciseId))
        .where(
          and(
            inArray(sessionSets.exerciseId, anchorIds),
            eq(sessions.userId, user.id),
            isNotNull(sessionSets.completedAt),
            isNotNull(sessions.finishedAt),
            eq(sessionSets.isWarmup, false),
            eq(sessionSets.isDropSet, false)
          )
        )
        .orderBy(desc(sessions.startedAt), asc(sessionSets.setNumber))
    : [];

  const groupedSessions = new Map<
    string,
    { name: string; startedAt: Date; sets: { weightKg: number; reps: number }[] }
  >();
  for (const set of anchorSets) {
    const key = `${set.exerciseId}:${set.sessionId}`;
    const group = groupedSessions.get(key) ?? {
      name: set.exerciseName,
      startedAt: set.startedAt,
      sets: [],
    };
    group.sets.push({ weightKg: set.weightKg, reps: set.reps });
    groupedSessions.set(key, group);
  }
  const anchorHistories: Record<
    string,
    { weightKg: number; totalReps: number; startedAt: Date }[]
  > = {};
  for (const group of groupedSessions.values()) {
    const workingWeight = Math.max(...group.sets.map((set) => set.weightKg));
    const performance = {
      weightKg: workingWeight,
      totalReps: group.sets
        .filter((set) => Math.abs(set.weightKg - workingWeight) < 0.05)
        .reduce((total, set) => total + set.reps, 0),
      startedAt: group.startedAt,
    };
    const history = anchorHistories[group.name] ?? [];
    history.push(performance);
    anchorHistories[group.name] = history;
  }
  for (const history of Object.values(anchorHistories)) {
    history.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }
  const decliningAnchors = findDecliningAnchors(anchorHistories);
  const status = buildTrainingPlanStatus({
    blockStartedOn: state.blockStartedOn,
    today: todayISO(),
    isDeload: state.isDeload,
    checkin: latestCheckin ?? null,
    decliningAnchors,
  });

  const routineMap = new Map<
    number,
    { id: number; name: string; position: number; exercises: typeof routineRows }
  >();
  for (const row of routineRows) {
    const routine = routineMap.get(row.routineId) ?? {
      id: row.routineId,
      name: row.routineName,
      position: row.routinePosition,
      exercises: [],
    };
    routine.exercises.push(row);
    routineMap.set(row.routineId, routine);
  }

  return NextResponse.json({
    state,
    status,
    latestCheckin: latestCheckin ?? null,
    routines: [...routineMap.values()],
  });
}

export async function PATCH(req: Request) {
  const user = await requireAppUser();
  await ensureState(user.id);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const today = todayISO();

  if (action === "checkin") {
    const [row] = await db
      .insert(trainingCheckins)
      .values({
        userId: user.id,
        day: today,
        sleepPoor: !!body.sleepPoor,
        appetiteLow: !!body.appetiteLow,
        jointPain: !!body.jointPain,
        notes: body.notes ? String(body.notes).slice(0, 1000) : null,
      })
      .onConflictDoUpdate({
        target: [trainingCheckins.userId, trainingCheckins.day],
        set: {
          sleepPoor: !!body.sleepPoor,
          appetiteLow: !!body.appetiteLow,
          jointPain: !!body.jointPain,
          notes: body.notes ? String(body.notes).slice(0, 1000) : null,
        },
      })
      .returning();
    return NextResponse.json(row);
  }

  if (action === "start_deload") {
    const [row] = await db
      .update(trainingPlanState)
      .set({ isDeload: true, deloadStartedOn: today, updatedAt: new Date() })
      .where(eq(trainingPlanState.userId, user.id))
      .returning();
    return NextResponse.json(row);
  }

  if (action === "finish_deload" || action === "start_new_block") {
    const [row] = await db
      .update(trainingPlanState)
      .set({
        blockStartedOn: today,
        isDeload: false,
        deloadStartedOn: null,
        updatedAt: new Date(),
      })
      .where(eq(trainingPlanState.userId, user.id))
      .returning();
    return NextResponse.json(row);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
