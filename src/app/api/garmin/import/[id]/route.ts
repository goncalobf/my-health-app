import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { withDbTransaction } from "@/db/transactions";
import { garminPendingImports, activitySessions } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { garminDenied, isGarminBrowserRequest } from "@/lib/garmin-browser-request";
import { garminActivityStart, isRecord, normalizeGarminActivity } from "@/lib/garmin-data";

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
  if (!isGarminBrowserRequest(req)) return garminDenied();
  const user = await requireAppUser();
  const { id } = await params;
  const importId = Number(id);

  if (!Number.isInteger(importId) || importId <= 0 || importId > 2147483647) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body.type !== "string" || !VALID_TYPES.has(body.type)) {
    return NextResponse.json({ error: "Invalid activity type" }, { status: 400 });
  }
  if (body.notes != null && (typeof body.notes !== "string" || body.notes.length > 1000)) {
    return NextResponse.json({ error: "Notes must be 1000 characters or fewer." }, { status: 400 });
  }
  if (body.division != null && (typeof body.division !== "string" || body.division.length > 200)) {
    return NextResponse.json({ error: "Division must be 200 characters or fewer." }, { status: 400 });
  }

  const ownedImport = and(eq(garminPendingImports.id, importId), eq(garminPendingImports.userId, user.id));
  return withDbTransaction(async (tx) => {
    const [pending] = await tx.select().from(garminPendingImports).where(ownedImport).for("update");
    if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (pending.labeledAt) return NextResponse.json({ error: "Already imported" }, { status: 409 });

    let staged: unknown;
    try {
      staged = JSON.parse(pending.garminDataJson) as unknown;
    } catch {
      return NextResponse.json({ error: "This Garmin activity is unreadable." }, { status: 422 });
    }
    const raw = normalizeGarminActivity(staged);
    const startedAt = raw && garminActivityStart(raw);
    if (!isRecord(staged) || !raw || !startedAt) {
      return NextResponse.json({ error: "Garmin did not supply a usable start time for this activity." }, { status: 422 });
    }

    const [alreadyImported] = await tx.select({ id: activitySessions.id }).from(activitySessions)
      .where(and(eq(activitySessions.userId, user.id), eq(activitySessions.garminActivityId, pending.garminActivityId)))
      .limit(1);
    if (alreadyImported) {
      await tx.update(garminPendingImports).set({ labeledAt: new Date() }).where(ownedImport);
      return NextResponse.json({ error: "Already imported" }, { status: 409 });
    }

    const durationSeconds = raw.duration ? Math.round(raw.duration) : null;
    const finishedAt = durationSeconds === null ? null : new Date(startedAt.getTime() + durationSeconds * 1000);
    const avgSpeedKmh =
      raw.averageSpeed && ["outdoor_cycling", "run_easy", "run_interval"].includes(body.type)
        ? Math.round(raw.averageSpeed * 3.6 * 10) / 10
        : null;

    const [session] = await tx.insert(activitySessions).values({
      userId: user.id,
      type: body.type,
      startedAt,
      finishedAt,
      durationSeconds,
      distanceM: typeof staged.distance === "number" ? raw.distance : null,
      elevationM: typeof staged.elevationGain === "number" ? raw.elevationGain : null,
      avgHeartRate: raw.averageHR ? Math.round(raw.averageHR) : null,
      maxHeartRate: raw.maxHR ? Math.round(raw.maxHR) : null,
      calories: raw.calories ? Math.round(raw.calories) : null,
      avgSpeedKmh,
      avgPowerW: raw.averagePower ? Math.round(raw.averagePower) : null,
      avgCadence: raw.averageCadence ? Math.round(raw.averageCadence) : null,
      notes: body.notes || null,
      division: body.division || null,
      garminActivityId: pending.garminActivityId,
    }).returning();

    await tx.update(garminPendingImports).set({ labeledAt: new Date() }).where(ownedImport);
    return NextResponse.json(session, { status: 201 });
  });
}
