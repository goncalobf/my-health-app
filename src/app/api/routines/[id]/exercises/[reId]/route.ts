import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { routineExercises } from "@/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; reId: string }> }
) {
  const { reId } = await params;
  const body = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = {};
  if (body.targetSets !== undefined) set.targetSets = Number(body.targetSets);
  if (body.targetReps !== undefined) set.targetReps = Number(body.targetReps);
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
  const { reId } = await params;
  await db
    .delete(routineExercises)
    .where(eq(routineExercises.id, Number(reId)));
  return NextResponse.json({ ok: true });
}
