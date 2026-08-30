import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activitySessions,
  activityIntervals,
  hyroxSegments,
} from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const sessionId = Number(id);

  const [session] = await db
    .select()
    .from(activitySessions)
    .where(
      and(
        eq(activitySessions.id, sessionId),
        eq(activitySessions.userId, user.id)
      )
    );
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [intervals, segments] = await Promise.all([
    db
      .select()
      .from(activityIntervals)
      .where(eq(activityIntervals.activitySessionId, sessionId))
      .orderBy(asc(activityIntervals.intervalNumber)),
    db
      .select()
      .from(hyroxSegments)
      .where(eq(hyroxSegments.activitySessionId, sessionId))
      .orderBy(asc(hyroxSegments.segmentNumber)),
  ]);

  return NextResponse.json({ ...session, intervals, segments });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const sessionId = Number(id);

  const [existing] = await db
    .select({ id: activitySessions.id })
    .from(activitySessions)
    .where(
      and(
        eq(activitySessions.id, sessionId),
        eq(activitySessions.userId, user.id)
      )
    );
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const patch: Partial<typeof activitySessions.$inferInsert> = {};
  if (body.finishedAt !== undefined) patch.finishedAt = body.finishedAt ? new Date(body.finishedAt) : null;
  if (body.durationSeconds !== undefined) patch.durationSeconds = body.durationSeconds != null ? Number(body.durationSeconds) : null;
  if (body.distanceM !== undefined) patch.distanceM = body.distanceM != null ? Number(body.distanceM) : null;
  if (body.elevationM !== undefined) patch.elevationM = body.elevationM != null ? Number(body.elevationM) : null;
  if (body.avgHeartRate !== undefined) patch.avgHeartRate = body.avgHeartRate != null ? Number(body.avgHeartRate) : null;
  if (body.maxHeartRate !== undefined) patch.maxHeartRate = body.maxHeartRate != null ? Number(body.maxHeartRate) : null;
  if (body.calories !== undefined) patch.calories = body.calories != null ? Number(body.calories) : null;
  if (body.avgSpeedKmh !== undefined) patch.avgSpeedKmh = body.avgSpeedKmh != null ? Number(body.avgSpeedKmh) : null;
  if (body.avgPowerW !== undefined) patch.avgPowerW = body.avgPowerW != null ? Number(body.avgPowerW) : null;
  if (body.avgCadence !== undefined) patch.avgCadence = body.avgCadence != null ? Number(body.avgCadence) : null;
  if (body.notes !== undefined) patch.notes = body.notes ? String(body.notes) : null;
  if (body.division !== undefined) patch.division = body.division ? String(body.division) : null;
  if (body.location !== undefined) patch.location = body.location ? String(body.location) : null;
  if (body.roxZoneSeconds !== undefined) patch.roxZoneSeconds = body.roxZoneSeconds != null ? Number(body.roxZoneSeconds) : null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(activitySessions)
    .set(patch)
    .where(eq(activitySessions.id, sessionId))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const sessionId = Number(id);

  const [existing] = await db
    .select({ id: activitySessions.id })
    .from(activitySessions)
    .where(
      and(
        eq(activitySessions.id, sessionId),
        eq(activitySessions.userId, user.id)
      )
    );
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .delete(activitySessions)
    .where(eq(activitySessions.id, sessionId));

  return new NextResponse(null, { status: 204 });
}
