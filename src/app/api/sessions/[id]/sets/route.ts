import { NextResponse } from "next/server";
import { db } from "@/db";
import { exercises, sessions, sessionSets } from "@/db/schema";
import { and, eq, isNull, or } from "drizzle-orm";
import { requireAppUser } from "@/lib/app-user";

import { createSet } from "@/lib/training-validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireAppUser();
  const { id } = await params;
  if(![Number(id)].every(n=>Number.isSafeInteger(n)&&n>0&&n<=2147483647)) return NextResponse.json({error:"Invalid identifier"},{status:400});
  const sessionId = Number(id);
  const [ownedSession] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id)));
  if (!ownedSession)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const parsed = createSet.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Enter a valid weight, positive reps and RIR from 0 to 10" },
      { status: 400 },
    );
  const body = parsed.data;
  const exerciseId = body.exerciseId;
  const [availableExercise] = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        eq(exercises.id, exerciseId),
        or(isNull(exercises.ownerUserId), eq(exercises.ownerUserId, user.id)),
      ),
    );
  if (!availableExercise)
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  const [row] = await db
    .insert(sessionSets)
    .values({
      sessionId,
      exerciseId,
      setNumber: body.setNumber,
      weightKg: body.weightKg,
      reps: body.reps,
      rir: body.rir,
      isWarmup: body.isWarmup,
      isDropSet: body.isDropSet,
      completedAt: body.completed ? new Date() : null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
