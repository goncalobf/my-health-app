import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coachMemory } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  const [row] = await db.select({ notes: coachMemory.notes }).from(coachMemory).where(eq(coachMemory.userId, user.id));
  return NextResponse.json({ notes: row?.notes ?? [] });
}

// No `index` param clears every note; an `index` param removes just that one.
export async function DELETE(req: Request) {
  const user = await requireAppUser();
  const [row] = await db.select({ notes: coachMemory.notes }).from(coachMemory).where(eq(coachMemory.userId, user.id));
  if (!row) return NextResponse.json({ notes: [] });

  const indexParam = new URL(req.url).searchParams.get("index");
  if (indexParam == null) {
    await db.update(coachMemory).set({ notes: [], updatedAt: new Date() }).where(eq(coachMemory.userId, user.id));
    return NextResponse.json({ notes: [] });
  }

  const index = Number(indexParam);
  if (!Number.isInteger(index) || index < 0 || index >= row.notes.length) {
    return NextResponse.json({ error: "Invalid note index" }, { status: 400 });
  }
  const notes = row.notes.filter((_, i) => i !== index);
  await db.update(coachMemory).set({ notes, updatedAt: new Date() }).where(eq(coachMemory.userId, user.id));
  return NextResponse.json({ notes });
}
