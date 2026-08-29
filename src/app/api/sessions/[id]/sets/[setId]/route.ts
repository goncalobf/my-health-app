import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, sessionSets } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

async function ownsSet(userId: number, sessionId: number, setId: number) {
  const [row] = await db
    .select({ id: sessionSets.id })
    .from(sessionSets)
    .innerJoin(sessions, eq(sessions.id, sessionSets.sessionId))
    .where(and(eq(sessionSets.id, setId), eq(sessionSets.sessionId, sessionId), eq(sessions.userId, userId)));
  return !!row;
}

function parseRir(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10, Math.round(parsed))) : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  const user = await requireAppUser();
  const { id, setId } = await params;
  if (!(await ownsSet(user.id, Number(id), Number(setId)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = {};
  if (body.weightKg !== undefined) set.weightKg = Number(body.weightKg);
  if (body.reps !== undefined) set.reps = Number(body.reps);
  if (body.rir !== undefined) {
    set.rir = parseRir(body.rir);
  }
  if (body.isWarmup !== undefined) set.isWarmup = !!body.isWarmup;
  if (body.completed === true) set.completedAt = new Date();
  if (body.completed === false) set.completedAt = null;

  const [row] = await db
    .update(sessionSets)
    .set(set)
    .where(eq(sessionSets.id, Number(setId)))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  const user = await requireAppUser();
  const { id, setId } = await params;
  if (!(await ownsSet(user.id, Number(id), Number(setId)))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.delete(sessionSets).where(eq(sessionSets.id, Number(setId)));
  return NextResponse.json({ ok: true });
}
