import { NextResponse } from "next/server";
import { db } from "@/db";
import { exercises, sessions, sessionSets } from "@/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { requireAppUser } from "@/lib/app-user";

function parseRir(value: unknown) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(10, Math.round(parsed))) : null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const sessionId = Number(id);
  const [ownedSession] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
  if (!ownedSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const exerciseId = Number(body.exerciseId);
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
  }
  const [availableExercise] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(and(eq(exercises.id, exerciseId), or(isNull(exercises.ownerUserId), eq(exercises.ownerUserId, user.id))));
  if (!availableExercise) return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  const [row] = await db
    .insert(sessionSets)
    .values({
      sessionId,
      exerciseId,
      setNumber: body.setNumber ? Number(body.setNumber) : 1,
      weightKg: body.weightKg != null ? Number(body.weightKg) : 0,
      reps: body.reps != null ? Number(body.reps) : 0,
      rir: parseRir(body.rir),
      isWarmup: !!body.isWarmup,
      completedAt: body.completed ? new Date() : null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
