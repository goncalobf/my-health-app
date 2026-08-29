import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { routineExercises, routines } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

async function ownsSlot(userId: number, routineId: number, slotId: number) {
  const [row] = await db
    .select({ id: routineExercises.id })
    .from(routineExercises)
    .innerJoin(routines, eq(routines.id, routineExercises.routineId))
    .where(and(eq(routineExercises.id, slotId), eq(routineExercises.routineId, routineId), eq(routines.userId, userId)));
  return !!row;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; reId: string }> }
) {
  const user = await requireAppUser();
  const { id, reId } = await params;
  if (!(await ownsSlot(user.id, Number(id), Number(reId)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = {};
  if (body.targetSets !== undefined) set.targetSets = Number(body.targetSets);
  if (body.targetReps !== undefined) set.targetReps = Number(body.targetReps);
  if (body.minReps !== undefined) set.minReps = Number(body.minReps);
  if (body.maxReps !== undefined) {
    set.maxReps = Number(body.maxReps);
    set.targetReps = Number(body.maxReps);
  }
  if (body.weightIncrementKg !== undefined)
    set.weightIncrementKg = Number(body.weightIncrementKg);
  if (body.restSeconds !== undefined)
    set.restSeconds = Number(body.restSeconds);
  if (body.targetWeightKg !== undefined)
    set.targetWeightKg =
      body.targetWeightKg === "" || body.targetWeightKg == null
        ? null
        : Number(body.targetWeightKg);
  if (body.position !== undefined) set.position = Number(body.position);

  const [row] = await db
    .update(routineExercises)
    .set(set)
    .where(eq(routineExercises.id, Number(reId)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; reId: string }> }
) {
  const user = await requireAppUser();
  const { id, reId } = await params;
  if (!(await ownsSlot(user.id, Number(id), Number(reId)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db
    .delete(routineExercises)
    .where(eq(routineExercises.id, Number(reId)));
  return NextResponse.json({ ok: true });
}
