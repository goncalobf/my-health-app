import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { coachMemory } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { forgetCoachMemory } from "@/lib/coach-storage";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await requireAppUser();
  const [row] = await db.select({ notes: coachMemory.notes }).from(coachMemory).where(eq(coachMemory.userId, user.id));
  return NextResponse.json({ notes: row?.notes ?? [] }, { headers });
}

// No index clears every note. A single-note request can carry the note the user picked.
export async function DELETE(req: Request) {
  const user = await requireAppUser();
  const indexParam = new URL(req.url).searchParams.get("index");
  const index = indexParam === null ? null : Number(indexParam);
  if (index !== null && (!/^\d+$/.test(indexParam ?? "") || !Number.isSafeInteger(index))) {
    return NextResponse.json({ error: "Invalid note index" }, { status: 400, headers });
  }
  const body = index === null ? null : await req.json().catch(() => null);
  const expectedNote = typeof body?.note === "string" ? body.note : undefined;
  const result = await forgetCoachMemory(user.id, index === null ? null : { index, expectedNote });
  if (result.status === "invalid") {
    return NextResponse.json({ error: "Invalid note index" }, { status: 400, headers });
  }
  if (result.status === "changed") {
    return NextResponse.json({ error: "Coach memory changed. Review the notes and try again." }, { status: 409, headers });
  }
  return NextResponse.json({ notes: result.notes }, { headers });
}
