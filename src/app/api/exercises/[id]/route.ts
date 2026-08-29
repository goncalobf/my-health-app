import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
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
    .where(and(eq(exercises.id, Number(id)), eq(exercises.ownerUserId, user.id)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  await db.delete(exercises).where(and(eq(exercises.id, Number(id)), eq(exercises.ownerUserId, user.id)));
  return NextResponse.json({ ok: true });
}
