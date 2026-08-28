import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exercises } from "@/db/schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const [row] = await db
    .update(exercises)
    .set({
      ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
      ...(body.muscleGroup !== undefined
        ? { muscleGroup: body.muscleGroup ? String(body.muscleGroup) : null }
        : {}),
      ...(body.notes !== undefined
        ? { notes: body.notes ? String(body.notes) : null }
        : {}),
    })
    .where(eq(exercises.id, Number(id)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(exercises).where(eq(exercises.id, Number(id)));
  return NextResponse.json({ ok: true });
}
