import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessionSets } from "@/db/schema";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = Number(id);
  const body = await req.json().catch(() => ({}));
  const exerciseId = Number(body.exerciseId);
  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId required" }, { status: 400 });
  }
  const [row] = await db
    .insert(sessionSets)
    .values({
      sessionId,
      exerciseId,
      setNumber: body.setNumber ? Number(body.setNumber) : 1,
      weightKg: body.weightKg != null ? Number(body.weightKg) : 0,
      reps: body.reps != null ? Number(body.reps) : 0,
      isWarmup: !!body.isWarmup,
      completedAt: body.completed ? new Date() : null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
