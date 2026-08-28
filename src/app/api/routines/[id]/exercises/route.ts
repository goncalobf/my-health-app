import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { routineExercises } from "@/db/schema";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const routineId = Number(id);
  const body = await req.json().catch(() => ({}));
  const exerciseId = Number(body.exerciseId);
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
  }
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
      targetWeightKg:
        body.targetWeightKg != null && body.targetWeightKg !== ""
          ? Number(body.targetWeightKg)
          : null,
      restSeconds: body.restSeconds ? Number(body.restSeconds) : 120,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
