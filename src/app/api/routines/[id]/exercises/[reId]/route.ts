import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { routineExercises, routines } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

import {
  prescriptionPatch,
  validPrescription,
} from "@/lib/training-validation";

async function ownsSlot(userId: number, routineId: number, slotId: number) {
  const [row] = await db
    .select({ slot: routineExercises })
    .from(routineExercises)
    .innerJoin(routines, eq(routines.id, routineExercises.routineId))
    .where(
      and(
        eq(routineExercises.id, slotId),
        eq(routineExercises.routineId, routineId),
        eq(routines.userId, userId),
      ),
    );
  return row?.slot;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; reId: string }> },
) {
  const user = await requireAppUser();
  const { id, reId } = await params;
  if(![Number(id),Number(reId)].every(n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647)) return NextResponse.json({error:"Invalid identifier"},{status:400});
  const existing = await ownsSlot(user.id, Number(id), Number(reId));
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const patch = prescriptionPatch.safeParse(await req.json().catch(() => null));
  if (!patch.success || !Object.keys(patch.data).length)
    return NextResponse.json(
      { error: "Invalid prescription" },
      { status: 400 },
    );
  const validated = validPrescription.safeParse({ ...existing, ...patch.data });
  if (!validated.success)
    return NextResponse.json(
      { error: validated.error.issues[0].message },
      { status: 400 },
    );
  const set = { ...validated.data, targetReps: validated.data.maxReps };

  const [row] = await db
    .update(routineExercises)
    .set(set)
    .where(eq(routineExercises.id, Number(reId)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; reId: string }> },
) {
  const user = await requireAppUser();
  const { id, reId } = await params;
  if(![Number(id),Number(reId)].every(n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647)) return NextResponse.json({error:"Invalid identifier"},{status:400});
  if (!(await ownsSlot(user.id, Number(id), Number(reId)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db
    .delete(routineExercises)
    .where(eq(routineExercises.id, Number(reId)));
  return NextResponse.json({ ok: true });
}
