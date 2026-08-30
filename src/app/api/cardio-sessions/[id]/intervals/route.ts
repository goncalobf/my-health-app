import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activitySessions, activityIntervals } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

async function ownerSession(userId: number, sessionId: number) {
  const [row] = await db
    .select({ id: activitySessions.id, type: activitySessions.type })
    .from(activitySessions)
    .where(
      and(
        eq(activitySessions.id, sessionId),
        eq(activitySessions.userId, userId)
      )
    );
  return row;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const sessionId = Number(id);

  const session = await ownerSession(user.id, sessionId);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.type !== "run_interval") {
    return NextResponse.json({ error: "Not an interval run session" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const intervalNumber = Number(body.intervalNumber);
  if (!isFinite(intervalNumber) || intervalNumber < 1) {
    return NextResponse.json({ error: "Invalid intervalNumber" }, { status: 400 });
  }

  const [row] = await db
    .insert(activityIntervals)
    .values({
      activitySessionId: sessionId,
      intervalNumber,
      targetDistanceM: body.targetDistanceM != null ? Number(body.targetDistanceM) : null,
      actualDistanceM: body.actualDistanceM != null ? Number(body.actualDistanceM) : null,
      durationSeconds: body.durationSeconds != null ? Number(body.durationSeconds) : null,
      avgHeartRate: body.avgHeartRate != null ? Number(body.avgHeartRate) : null,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
