import { and, asc, desc, eq, gt, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appUsers,
  exercises,
  friendships,
  routineExercises,
  routines,
  sessions,
  sessionSets,
} from "@/db/schema";
import { est1RM } from "@/lib/utils";

interface FriendSummary { id: number; username: string | null; name: string | null; }

/** Accepted friends plus incoming/outgoing pending requests, each with the other party's basic info. */
export async function listFriendships(userId: number) {
  const rows = await db
    .select({
      id: friendships.id,
      status: friendships.status,
      requesterId: friendships.requesterId,
      recipientId: friendships.recipientId,
      createdAt: friendships.createdAt,
      otherUser: { id: appUsers.id, username: appUsers.username, name: appUsers.name },
    })
    .from(friendships)
    .innerJoin(
      appUsers,
      eq(appUsers.id, sql`case when ${friendships.requesterId} = ${userId} then ${friendships.recipientId} else ${friendships.requesterId} end`)
    )
    .where(or(eq(friendships.requesterId, userId), eq(friendships.recipientId, userId)))
    .orderBy(desc(friendships.createdAt));

  const friends: (FriendSummary & { friendshipId: number })[] = [];
  const incoming: (FriendSummary & { friendshipId: number })[] = [];
  const outgoing: (FriendSummary & { friendshipId: number })[] = [];
  for (const row of rows) {
    const entry = { ...row.otherUser, friendshipId: row.id };
    if (row.status === "accepted") friends.push(entry);
    else if (row.status === "pending" && row.recipientId === userId) incoming.push(entry);
    else if (row.status === "pending" && row.requesterId === userId) outgoing.push(entry);
  }
  return { friends, incoming, outgoing };
}

/**
 * Resolves an accepted friendship row for the caller and returns the other
 * party's user id. Used to key every friend-data route off the friendship
 * row id rather than a bare friend user id — Next.js can't mix `[id]` and a
 * differently-named dynamic segment at the same path depth, and tying access
 * to a specific accepted-friendship row is the more direct ownership check.
 */
export async function resolveAcceptedFriendship(friendshipId: number, callerId: number) {
  const [row] = await db
    .select()
    .from(friendships)
    .where(and(eq(friendships.id, friendshipId), eq(friendships.status, "accepted")));
  if (!row) return null;
  if (row.requesterId !== callerId && row.recipientId !== callerId) return null;
  const friendUserId = row.requesterId === callerId ? row.recipientId : row.requesterId;
  return { friendshipId: row.id, friendUserId };
}

/** Most recent friendship row between two users in either direction, regardless of status. */
export async function findExistingFriendship(userId: number, otherUserId: number) {
  const [row] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, userId), eq(friendships.recipientId, otherUserId)),
        and(eq(friendships.requesterId, otherUserId), eq(friendships.recipientId, userId))
      )
    )
    .orderBy(desc(friendships.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getFriendRoutines(friendUserId: number) {
  return db
    .select({
      id: routines.id,
      name: routines.name,
      notes: routines.notes,
      position: routines.position,
      exerciseCount: sql<number>`count(${routineExercises.id})::int`,
    })
    .from(routines)
    .leftJoin(routineExercises, eq(routineExercises.routineId, routines.id))
    .where(and(eq(routines.userId, friendUserId), eq(routines.archived, false)))
    .groupBy(routines.id)
    .orderBy(asc(routines.position), asc(routines.id));
}

async function getRoutineDetail(userId: number, routineId: number) {
  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)));
  if (!routine) return null;
  const items = await db
    .select({
      id: routineExercises.id,
      exerciseId: routineExercises.exerciseId,
      exerciseOwnerUserId: exercises.ownerUserId,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      imageUrl: exercises.imageUrl,
      position: routineExercises.position,
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
      isAnchor: routineExercises.isAnchor,
    })
    .from(routineExercises)
    .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
    .where(eq(routineExercises.routineId, routineId))
    .orderBy(asc(routineExercises.position), asc(routineExercises.id));
  return { ...routine, exercises: items };
}

export async function getFriendRoutineDetail(friendUserId: number, routineId: number) {
  return getRoutineDetail(friendUserId, routineId);
}

/** Copies a friend's routine (and any of their private exercises it uses)
 *  into the caller's own account. A snapshot, not a live link. */
export async function cloneRoutineForUser(
  friendUserId: number,
  routineId: number,
  targetUserId: number
) {
  const source = await getRoutineDetail(friendUserId, routineId);
  if (!source) return null;

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${routines.position}), 0)::int` })
    .from(routines)
    .where(eq(routines.userId, targetUserId));
  const [newRoutine] = await db
    .insert(routines)
    .values({ userId: targetUserId, name: source.name, notes: source.notes, position: (max ?? 0) + 1 })
    .returning();

  for (const item of source.exercises) {
    // Shared exercises (ownerUserId null) are referenced directly. A private
    // exercise owned by the friend has to be copied — the target user has no
    // right to reference it (api-data-security.md: shared or self-owned only).
    let exerciseId = item.exerciseId;
    if (item.exerciseOwnerUserId === friendUserId) {
      const [cloned] = await db
        .insert(exercises)
        .values({
          name: item.name,
          muscleGroup: item.muscleGroup,
          imageUrl: item.imageUrl,
          ownerUserId: targetUserId,
        })
        .returning();
      exerciseId = cloned.id;
    }
    await db.insert(routineExercises).values({
      routineId: newRoutine.id,
      exerciseId,
      position: item.position,
      targetSets: item.targetSets,
      targetReps: item.targetReps,
      minReps: item.minReps,
      maxReps: item.maxReps,
      targetWeightKg: item.targetWeightKg,
      weightIncrementKg: item.weightIncrementKg,
      restSeconds: item.restSeconds,
      targetRirMin: item.targetRirMin,
      targetRirMax: item.targetRirMax,
      avoidFailure: item.avoidFailure,
      instruction: item.instruction,
      isAnchor: item.isAnchor,
    });
  }

  return newRoutine;
}

/** Recent finished sessions plus best-set PRs, same shape/logic as the
 *  owner's own /api/sessions and /api/progress/prs, scoped to a friend. */
export async function getFriendHistory(friendUserId: number) {
  const recentSessions = await db
    .select({
      id: sessions.id,
      name: sessions.name,
      startedAt: sessions.startedAt,
      finishedAt: sessions.finishedAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, friendUserId), isNotNull(sessions.finishedAt)))
    .orderBy(desc(sessions.startedAt))
    .limit(20);

  const setRows = await db
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
        eq(sessionSets.isDropSet, false),
        eq(sessions.userId, friendUserId),
        gt(sessionSets.reps, 0),
        gt(sessionSets.weightKg, 0),
        isNotNull(sessionSets.completedAt)
      )
    );

  const best = new Map<number, { exerciseId: number; name: string; bestWeightKg: number; bestReps: number; est1RM: number }>();
  for (const r of setRows) {
    const e1 = est1RM(r.weightKg, r.reps);
    const cur = best.get(r.exerciseId);
    if (!cur || e1 > cur.est1RM) {
      best.set(r.exerciseId, { exerciseId: r.exerciseId, name: r.name, bestWeightKg: r.weightKg, bestReps: r.reps, est1RM: e1 });
    }
  }

  return {
    recentSessions,
    personalRecords: [...best.values()].sort((a, b) => b.est1RM - a.est1RM),
  };
}
