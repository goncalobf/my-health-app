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

/** Reorders this routine's exercise slots. Body: `{ order: number[] }`, the
 *  slot IDs in their new top-to-bottom order. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const routineId = Number(id);
  const [ownedRoutine] = await db
    .select({ id: routines.id })
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, user.id)));
  if (!ownedRoutine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const order: number[] | null = Array.isArray(body.order)
    ? body.order.map(Number).filter((n: number) => Number.isInteger(n))
    : null;
  if (!order || order.length === 0) {
    return NextResponse.json({ error: "order required" }, { status: 400 });
  }

  const existing = await db
    .select({ id: routineExercises.id })
    .from(routineExercises)
    .where(eq(routineExercises.routineId, routineId));
  const existingIds = new Set(existing.map((row) => row.id));
  const isExactMatch =
    order.length === existingIds.size &&
    new Set(order).size === order.length &&
    order.every((slotId) => existingIds.has(slotId));
  if (!isExactMatch) {
    return NextResponse.json(
      { error: "order must contain exactly this routine's exercise slots" },
      { status: 400 }
    );
  }

  for (let i = 0; i < order.length; i++) {
    await db
      .update(routineExercises)
      .set({ position: i + 1 })
      .where(eq(routineExercises.id, order[i]));
  }
  return NextResponse.json({ ok: true });
}
