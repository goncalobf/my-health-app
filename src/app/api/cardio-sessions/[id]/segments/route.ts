import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activitySessions, hyroxSegments } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

const STATION_NAMES = new Set([
  "ski_erg",
  "sled_push",
  "sled_pull",
  "burpee_broad_jump",
  "rowing",
  "farmers_carry",
  "sandbag_lunges",
  "wall_balls",
]);

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
  if (session.type !== "hyrox") {
    return NextResponse.json({ error: "Not a Hyrox session" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const segmentNumber = Number(body.segmentNumber);
  if (!isFinite(segmentNumber) || segmentNumber < 1 || segmentNumber > 8) {
    return NextResponse.json({ error: "segmentNumber must be 1–8" }, { status: 400 });
  }
  if (!["run", "station"].includes(body.segmentType)) {
    return NextResponse.json({ error: "segmentType must be run or station" }, { status: 400 });
  }
  if (body.segmentType === "station" && !STATION_NAMES.has(body.stationName)) {
    return NextResponse.json({ error: "Invalid stationName" }, { status: 400 });
  }

  const [row] = await db
    .insert(hyroxSegments)
    .values({
      activitySessionId: sessionId,
      segmentNumber,
      segmentType: body.segmentType,
      stationName: body.stationName ?? null,
      durationSeconds: body.durationSeconds != null ? Number(body.durationSeconds) : null,
      avgHeartRate: body.avgHeartRate != null ? Number(body.avgHeartRate) : null,
      weightKg: body.weightKg != null ? Number(body.weightKg) : null,
      repsOrDistanceM: body.repsOrDistanceM != null ? Number(body.repsOrDistanceM) : null,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
