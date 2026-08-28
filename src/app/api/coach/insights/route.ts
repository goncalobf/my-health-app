import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { coachInsights } from "@/db/schema";
import { getCoachSnapshot } from "@/lib/coach-data";
import { CoachInsightPayload, insightSchema } from "@/lib/coach";
import { COACH_MODEL, isCoachConfigured, structuredCoachResponse } from "@/lib/openai";
import { todayISO } from "@/lib/utils";

function publicRow(row: typeof coachInsights.$inferSelect) {
  return { ...row, payload: JSON.parse(row.payloadJson) as CoachInsightPayload, payloadJson: undefined };
}

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  const where = kind
    ? and(eq(coachInsights.kind, kind), isNull(coachInsights.dismissedAt))
    : isNull(coachInsights.dismissedAt);
  const rows = await db.select().from(coachInsights).where(where)
    .orderBy(desc(coachInsights.createdAt)).limit(12);
  return NextResponse.json({ configured: isCoachConfigured(), model: COACH_MODEL, insights: rows.map(publicRow) });
}

export async function POST(req: Request) {
  if (!isCoachConfigured()) return NextResponse.json({ error: "Add OPENAI_API_KEY in Vercel to enable Fitlog Coach." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const kind = ["daily", "weekly", "post_workout"].includes(body.kind) ? String(body.kind) : "daily";
  const sessionId = body.sessionId ? Number(body.sessionId) : undefined;
  if (kind === "post_workout" && !sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const sourceKey = kind === "post_workout" ? `session:${sessionId}` : `${kind}:${todayISO()}`;
  if (!body.refresh) {
    const [cached] = await db.select().from(coachInsights)
      .where(and(eq(coachInsights.kind, kind), eq(coachInsights.sourceKey, sourceKey), isNull(coachInsights.dismissedAt)))
      .orderBy(desc(coachInsights.createdAt)).limit(1);
    if (cached) return NextResponse.json(publicRow(cached));
  }

  const snapshot = await getCoachSnapshot({ days: kind === "weekly" ? 28 : 14, sessionId });
  const tasks: Record<string, string> = {
    daily: "Create 1-3 useful coaching insights for today. Prioritize adherence, remaining macros, scheduled training, and recent trends. Do not invent missing data.",
    weekly: "Create a weekly recomposition review with 3-5 prioritized insights covering training progression, nutrition consistency, Garmin expenditure, weight trend, and recovery signals inferred only from performance. Give concrete next-week actions.",
    post_workout: "Analyze this completed workout. Compare performance only with history present in the data, recognize progress, flag repeated under-performance cautiously, and give practical next-session guidance without overriding Fitlog's calculated targets.",
  };
  try {
    const payload = await structuredCoachResponse<CoachInsightPayload>({
      name: "fitlog_coach_insights", schema: insightSchema, task: tasks[kind], data: snapshot,
    });
    const [row] = await db.insert(coachInsights).values({
      kind, sourceKey, payloadJson: JSON.stringify(payload), model: COACH_MODEL,
    }).returning();
    return NextResponse.json(publicRow(row), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Coach request failed." }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [row] = await db.update(coachInsights).set({ dismissedAt: new Date() })
    .where(eq(coachInsights.id, id)).returning();
  return NextResponse.json(row);
}
