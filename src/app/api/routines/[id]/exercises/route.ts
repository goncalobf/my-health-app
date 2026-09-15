import { NextResponse } from "next/server";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { exercises, routineExercises, routines } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

import {
  prescriptionPatch,
  validPrescription,
  defaultPrescription,
} from "@/lib/training-validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAppUser();
  const { id } = await params;
  if(![Number(id)].every(n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647)) return NextResponse.json({error:"Invalid identifier"},{status:400});
  const routineId = Number(id);
  const body = await req.json().catch(() => ({}));
  const [ownedRoutine] = await db
    .select({ id: routines.id })
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, user.id)));
  if (!ownedRoutine)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json(
      { error: "Invalid prescription" },
      { status: 400 },
    );
  const { exerciseId: rawId, ...fields } = body;
  const patch = prescriptionPatch.safeParse(fields);
  if (!patch.success)
    return NextResponse.json(
      { error: "Invalid prescription" },
      { status: 400 },
    );
  const validated = validPrescription.safeParse({
    ...defaultPrescription,
    ...patch.data,
  });
  if (!validated.success)
    return NextResponse.json(
      { error: validated.error.issues[0].message },
      { status: 400 },
    );
  const exerciseId = Number(rawId);
  if (!Number.isInteger(exerciseId) || exerciseId < 1) {
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
  }
  const [availableExercise] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        eq(exercises.id, exerciseId),
        or(isNull(exercises.ownerUserId), eq(exercises.ownerUserId, user.id)),
      ),
    );
  if (!availableExercise)
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  const [duplicate] = await db
    .select({ id: routineExercises.id })
    .from(routineExercises)
    .where(
      and(
        eq(routineExercises.routineId, routineId),
        eq(routineExercises.exerciseId, exerciseId),
      ),
    );
  if (duplicate)
    return NextResponse.json(
      { error: "This exercise is already in the routine" },
      { status: 400 },
    );
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
      ...validated.data,
      position: (max ?? 0) + 1,
      targetReps: validated.data.maxReps,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}

/** Reorders this routine's exercise slots. Body: `{ order: number[] }`, the
 *  slot IDs in their new top-to-bottom order. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAppUser();
  const { id } = await params;
  if(![Number(id)].every(n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647)) return NextResponse.json({error:"Invalid identifier"},{status:400});
  const routineId = Number(id);
  const [ownedRoutine] = await db
    .select({ id: routines.id })
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, user.id)));
  if (!ownedRoutine)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

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
      { status: 400 },
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
