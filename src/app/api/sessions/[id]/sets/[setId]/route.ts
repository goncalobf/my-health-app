import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessionSets } from "@/db/schema";

function parseRir(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10, Math.round(parsed))) : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; setId: string }> }
) {
  const { setId } = await params;
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
  const { setId } = await params;
  await db.delete(sessionSets).where(eq(sessionSets.id, Number(setId)));
  return NextResponse.json({ ok: true });
}
