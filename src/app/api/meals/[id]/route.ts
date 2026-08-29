import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mealTemplates } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser();
  const { id } = await params;
  await db.delete(mealTemplates).where(and(eq(mealTemplates.id, Number(id)), eq(mealTemplates.userId, user.id)));
  return NextResponse.json({ ok: true });
}
