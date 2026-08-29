import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { savedFoods } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser();
  const { id } = await params;
  await db.delete(savedFoods).where(and(eq(savedFoods.id, Number(id)), eq(savedFoods.userId, user.id)));
  return NextResponse.json({ ok: true });
}
