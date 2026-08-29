import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { nutritionLogs } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const [current] = await db.select().from(nutritionLogs).where(and(eq(nutritionLogs.id, Number(id)), eq(nutritionLogs.userId, user.id)));
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const quantityG = body.quantityG !== undefined ? Number(body.quantityG) : current.quantityG;
  const factor = current.quantityG > 0 ? quantityG / current.quantityG : 1;
  const [row] = await db.update(nutritionLogs).set({
    quantityG,
    calories: body.calories !== undefined ? Number(body.calories) : current.calories * factor,
    proteinG: body.proteinG !== undefined ? Number(body.proteinG) : current.proteinG * factor,
    carbsG: body.carbsG !== undefined ? Number(body.carbsG) : current.carbsG * factor,
    fatG: body.fatG !== undefined ? Number(body.fatG) : current.fatG * factor,
    ...(body.meal !== undefined ? { meal: String(body.meal) } : {}),
  }).where(and(eq(nutritionLogs.id, Number(id)), eq(nutritionLogs.userId, user.id))).returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  await db.delete(nutritionLogs).where(and(eq(nutritionLogs.id, Number(id)), eq(nutritionLogs.userId, user.id)));
  return NextResponse.json({ ok: true });
}
