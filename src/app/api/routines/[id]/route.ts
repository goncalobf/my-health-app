import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { routines, routineExercises, exercises } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const routineId = Number(id);
  const [routine] = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, user.id)));
  if (!routine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = await db
    .select({
      id: routineExercises.id,
      exerciseId: routineExercises.exerciseId,
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
      supersetGroup: routineExercises.supersetGroup,
      isAnchor: routineExercises.isAnchor,
    })
    .from(routineExercises)
    .innerJoin(exercises, eq(exercises.id, routineExercises.exerciseId))
    .where(eq(routineExercises.routineId, routineId))
    .orderBy(asc(routineExercises.position), asc(routineExercises.id));

  return NextResponse.json({ ...routine, exercises: items });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const [row] = await db
    .update(routines)
    .set({
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.notes !== undefined
        ? { notes: body.notes ? String(body.notes) : null }
        : {}),
      ...(body.archived !== undefined ? { archived: !!body.archived } : {}),
    })
    .where(and(eq(routines.id, Number(id)), eq(routines.userId, user.id)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  await db.delete(routines).where(and(eq(routines.id, Number(id)), eq(routines.userId, user.id)));
  return NextResponse.json({ ok: true });
}
