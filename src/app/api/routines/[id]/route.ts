import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { routines, routineExercises, exercises } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const routineId = Number(id);
  const [routine] = await db
    .select()
    .from(routines)
    .where(eq(routines.id, routineId));
  if (!routine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = await db
    .select({
      id: routineExercises.id,
      exerciseId: routineExercises.exerciseId,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
      position: routineExercises.position,
      targetSets: routineExercises.targetSets,
      targetReps: routineExercises.targetReps,
      targetWeightKg: routineExercises.targetWeightKg,
      restSeconds: routineExercises.restSeconds,
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
    .where(eq(routines.id, Number(id)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(routines).where(eq(routines.id, Number(id)));
  return NextResponse.json({ ok: true });
}
