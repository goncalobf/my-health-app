import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { coachInsights, sessions } from "@/db/schema";
import { getCoachSnapshot, saveCoachMemoryNote } from "@/lib/coach-data";
import { formatCoachSnapshotAsMarkdown } from "@/lib/coach-snapshot-markdown";
import { CoachInsightPayload, insightSchema } from "@/lib/coach";
import { COACH_MODEL, isCoachConfigured, structuredCoachResponse } from "@/lib/openai";
import { todayISO } from "@/lib/utils";
import { requireAppUser } from "@/lib/app-user";
import { isRateLimited } from "@/lib/rate-limit";

function publicRow(row: typeof coachInsights.$inferSelect) {
  return { ...row, payload: JSON.parse(row.payloadJson) as CoachInsightPayload, payloadJson: undefined };
}

export async function GET(req: Request) {
  const user = await requireAppUser();
  const kind = new URL(req.url).searchParams.get("kind");
  const where = kind
    ? and(eq(coachInsights.userId, user.id), eq(coachInsights.kind, kind), isNull(coachInsights.dismissedAt))
    : and(eq(coachInsights.userId, user.id), isNull(coachInsights.dismissedAt));
  const rows = await db.select().from(coachInsights).where(where)
    .orderBy(desc(coachInsights.createdAt)).limit(12);
  return NextResponse.json({ configured: isCoachConfigured(), model: COACH_MODEL, insights: rows.map(publicRow) });
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  if (!isCoachConfigured()) return NextResponse.json({ error: "Add OPENAI_API_KEY in Vercel to enable Fitlog Coach." }, { status: 503 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid insight request." }, { status: 400 });
  }
  const kind = body.kind ?? "daily";
  if (kind !== "daily" && kind !== "weekly" && kind !== "post_workout") {
    return NextResponse.json({ error: "Invalid insight type." }, { status: 400 });
  }
  const sessionId: number | undefined = kind === "post_workout" ? body.sessionId : undefined;
  if (kind === "post_workout") {
    if (typeof sessionId !== "number" || !Number.isInteger(sessionId) || sessionId <= 0 || sessionId > 2147483647) {
      return NextResponse.json({ error: "A valid session ID is required." }, { status: 400 });
    }
    const [owned] = await db.select({ id: sessions.id }).from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, user.id), isNotNull(sessions.finishedAt)));
    if (!owned) return NextResponse.json({ error: "Completed workout not found." }, { status: 404 });
  }
  const sourceKey = kind === "post_workout" ? `session:${sessionId}` : `${kind}:${todayISO()}`;
  if (body.refresh !== true) {
    const [cached] = await db.select().from(coachInsights)
      .where(and(eq(coachInsights.userId, user.id), eq(coachInsights.kind, kind), eq(coachInsights.sourceKey, sourceKey), isNull(coachInsights.dismissedAt)))
      .orderBy(desc(coachInsights.createdAt)).limit(1);
    if (cached) return NextResponse.json(publicRow(cached));
  }

  if (isRateLimited(`coach-insights:${user.id}`, { max: 20, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const snapshot = await getCoachSnapshot({ userId: user.id, days: kind === "weekly" ? 28 : 14, sessionId });
  try {
    const payload = await structuredCoachResponse<CoachInsightPayload>({
      name: `fitlog_coach_${kind}`, schema: insightSchema, data: formatCoachSnapshotAsMarkdown(snapshot),
    });
    const [row] = await db.insert(coachInsights).values({
      userId: user.id, kind, sourceKey, payloadJson: JSON.stringify(payload), model: COACH_MODEL,
    }).returning();
    await saveCoachMemoryNote(user.id, payload.memoryNote);
    return NextResponse.json(publicRow(row), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Coach request failed. Try again." }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [row] = await db.update(coachInsights).set({ dismissedAt: new Date() })
    .where(and(eq(coachInsights.id, id), eq(coachInsights.userId, user.id))).returning();
  return NextResponse.json(row);
}
