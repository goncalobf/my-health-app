import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mealTemplates } from "@/db/schema";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(mealTemplates).where(eq(mealTemplates.id, Number(id)));
  return NextResponse.json({ ok: true });
}
