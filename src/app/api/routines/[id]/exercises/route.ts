import { NextResponse } from "next/server";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { exercises, routineExercises, routines } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const routineId = Number(id);
  const body = await req.json().catch(() => ({}));
  const [ownedRoutine] = await db
    .select({ id: routines.id })
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, user.id)));
  if (!ownedRoutine) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const exerciseId = Number(body.exerciseId);
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
  }
  const [availableExercise] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), or(isNull(exercises.ownerUserId), eq(exercises.ownerUserId, user.id))));
  if (!availableExercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  const [{ max }] = await db
    .select({
      max: sql<number>`coalesce(max(${routineExercises.position}), 0)::int`,
    })
    .from(routineExercises)
    .where(eq(routineExercises.routineId, routineId));

  const [row] = await db
    .insert(routineExercises)
    .values({
      routineId,
      exerciseId,
      position: (max ?? 0) + 1,
      targetSets: body.targetSets ? Number(body.targetSets) : 3,
      targetReps: body.targetReps ? Number(body.targetReps) : 10,
      minReps: body.minReps ? Number(body.minReps) : 8,
      maxReps: body.maxReps ? Number(body.maxReps) : 12,
      targetWeightKg:
        body.targetWeightKg != null && body.targetWeightKg !== ""
          ? Number(body.targetWeightKg)
          : null,
      weightIncrementKg:
        body.weightIncrementKg != null ? Number(body.weightIncrementKg) : 2.5,
      restSeconds: body.restSeconds ? Number(body.restSeconds) : 120,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
