import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { garminPendingImports, activitySessions } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import type { GarminActivity } from "@/lib/garmin-client";

const VALID_TYPES = new Set([
  "run_easy",
  "run_interval",
  "indoor_cycling",
  "outdoor_cycling",
  "hyrox",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const importId = Number(id);

  const [pending] = await db
    .select()
    .from(garminPendingImports)
    .where(
      and(
        eq(garminPendingImports.id, importId),
        eq(garminPendingImports.userId, user.id)
      )
    );
  if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pending.labeledAt) return NextResponse.json({ error: "Already imported" }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  if (!VALID_TYPES.has(body.type)) {
    return NextResponse.json({ error: "Invalid activity type" }, { status: 400 });
  }
  if (body.notes != null && String(body.notes).length > 1000) {
    return NextResponse.json({ error: "Notes must be 1000 characters or fewer." }, { status: 400 });
  }
  if (body.division != null && String(body.division).length > 200) {
    return NextResponse.json({ error: "Division must be 200 characters or fewer." }, { status: 400 });
  }

  const raw = JSON.parse(pending.garminDataJson) as GarminActivity;

  // Map Garmin fields to Fitlog activity session fields.
  const durationSeconds = raw.duration ? Math.round(raw.duration) : null;
  const distanceM = raw.distance ?? null;
  const elevationM = raw.elevationGain ?? null;
  const avgHeartRate = raw.averageHR ? Math.round(raw.averageHR) : null;
  const maxHeartRate = raw.maxHR ? Math.round(raw.maxHR) : null;
  const calories = raw.calories ? Math.round(raw.calories) : null;
  // Convert m/s → km/h for outdoor activities
  const avgSpeedKmh =
    raw.averageSpeed && ["outdoor_cycling", "run_easy", "run_interval"].includes(body.type)
      ? Math.round(raw.averageSpeed * 3.6 * 10) / 10
      : null;
  const avgPowerW = raw.averagePower ? Math.round(raw.averagePower) : null;
  const avgCadence = raw.averageCadence ? Math.round(raw.averageCadence) : null;
  const startedAt = raw.startTimeLocal ? new Date(raw.startTimeLocal) : new Date();
  const finishedAt =
    durationSeconds && raw.startTimeLocal
      ? new Date(startedAt.getTime() + durationSeconds * 1000)
      : null;

  const [session] = await db
    .insert(activitySessions)
    .values({
      userId: user.id,
      type: body.type,
      startedAt,
      finishedAt,
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
      garminActivityId: pending.garminActivityId,
    })
    .returning();

  await db
    .update(garminPendingImports)
    .set({ labeledAt: new Date() })
    .where(eq(garminPendingImports.id, importId));

  return NextResponse.json(session, { status: 201 });
}
