import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activitySessions } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

const VALID_TYPES = new Set([
  "run_easy",
  "run_interval",
  "indoor_cycling",
  "outdoor_cycling",
  "hyrox",
]);

export async function GET() {
  const user = await requireAppUser();
  const rows = await db
    .select({
      id: activitySessions.id,
      type: activitySessions.type,
      startedAt: activitySessions.startedAt,
      finishedAt: activitySessions.finishedAt,
      durationSeconds: activitySessions.durationSeconds,
      distanceM: activitySessions.distanceM,
      avgHeartRate: activitySessions.avgHeartRate,
      calories: activitySessions.calories,
      division: activitySessions.division,
      garminActivityId: activitySessions.garminActivityId,
    })
    .from(activitySessions)
    .where(eq(activitySessions.userId, user.id))
    .orderBy(desc(activitySessions.startedAt))
    .limit(100);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));

  if (!VALID_TYPES.has(body.type)) {
    return NextResponse.json({ error: "Invalid activity type" }, { status: 400 });
  }

  const durationSeconds = body.durationSeconds != null ? Number(body.durationSeconds) : null;
  const distanceM = body.distanceM != null ? Number(body.distanceM) : null;
  const elevationM = body.elevationM != null ? Number(body.elevationM) : null;
  const avgHeartRate = body.avgHeartRate != null ? Number(body.avgHeartRate) : null;
  const maxHeartRate = body.maxHeartRate != null ? Number(body.maxHeartRate) : null;
  const calories = body.calories != null ? Number(body.calories) : null;
  const avgSpeedKmh = body.avgSpeedKmh != null ? Number(body.avgSpeedKmh) : null;
  const avgPowerW = body.avgPowerW != null ? Number(body.avgPowerW) : null;
  const avgCadence = body.avgCadence != null ? Number(body.avgCadence) : null;
  const roxZoneSeconds = body.roxZoneSeconds != null ? Number(body.roxZoneSeconds) : null;

  if (durationSeconds != null && (!isFinite(durationSeconds) || durationSeconds < 0)) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }
  if (distanceM != null && (!isFinite(distanceM) || distanceM < 0)) {
    return NextResponse.json({ error: "Invalid distance" }, { status: 400 });
  }
  if (body.notes != null && String(body.notes).length > 1000) {
    return NextResponse.json({ error: "Notes must be 1000 characters or fewer." }, { status: 400 });
  }
  if (body.division != null && String(body.division).length > 200) {
    return NextResponse.json({ error: "Division must be 200 characters or fewer." }, { status: 400 });
  }
  if (body.location != null && String(body.location).length > 200) {
    return NextResponse.json({ error: "Location must be 200 characters or fewer." }, { status: 400 });
  }

  const [session] = await db
    .insert(activitySessions)
    .values({
      userId: user.id,
      type: body.type,
      startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
      finishedAt: body.finishedAt ? new Date(body.finishedAt) : null,
      durationSeconds,
      distanceM,
      elevationM,
      avgHeartRate,
      maxHeartRate,
      calories,
      avgSpeedKmh,
      avgPowerW,
      avgCadence,
      notes: body.notes ? String(body.notes) : null,
      division: body.division ? String(body.division) : null,
      location: body.location ? String(body.location) : null,
      roxZoneSeconds,
      garminActivityId: body.garminActivityId ? String(body.garminActivityId) : null,
    })
    .returning();

  return NextResponse.json(session, { status: 201 });
}
