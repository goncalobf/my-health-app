import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { coachInsights } from "@/db/schema";
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
  const body = await req.json().catch(() => ({}));
  const kind = ["daily", "weekly", "post_workout"].includes(body.kind) ? String(body.kind) : "daily";
  const sessionId = body.sessionId ? Number(body.sessionId) : undefined;
  if (kind === "post_workout" && !sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const sourceKey = kind === "post_workout" ? `session:${sessionId}` : `${kind}:${todayISO()}`;
  if (!body.refresh) {
    const [cached] = await db.select().from(coachInsights)
      .where(and(eq(coachInsights.userId, user.id), eq(coachInsights.kind, kind), eq(coachInsights.sourceKey, sourceKey), isNull(coachInsights.dismissedAt)))
      .orderBy(desc(coachInsights.createdAt)).limit(1);
    if (cached) return NextResponse.json(publicRow(cached));
  }

  if (isRateLimited(`coach-insights:${user.id}`, { max: 20, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const snapshot = await getCoachSnapshot({ userId: user.id, days: kind === "weekly" ? 28 : 14, sessionId });
  const tasks: Record<string, string> = {
    daily: "Create 1-3 useful coaching insights for today. Prioritize any nutrition-phase check-in that is due, adherence, remaining macros, scheduled training, and recent trends. State the cutting week only when nutritionPhase is active. Do not invent missing data.",
    weekly: "Create a weekly recomposition review with 3-5 prioritized insights covering the current nutrition-phase duration and rate, training progression, nutrition consistency, Garmin expenditure, weight trend, and recovery signals inferred only from performance. There is no universal maximum cut length: use the supplied evidence rules and make diet breaks conditional on recovery, performance, symptoms, and adherence. Give concrete next-week actions.",
    post_workout: "Analyze this completed workout. Compare performance only with history present in the data, recognize progress, flag repeated under-performance cautiously, and give practical next-session guidance without overriding Fitlog's calculated targets.",
  };
  try {
    const payload = await structuredCoachResponse<CoachInsightPayload>({
      name: "fitlog_coach_insights", schema: insightSchema, task: tasks[kind], data: formatCoachSnapshotAsMarkdown(snapshot),
    });
    const [row] = await db.insert(coachInsights).values({
      userId: user.id, kind, sourceKey, payloadJson: JSON.stringify(payload), model: COACH_MODEL,
    }).returning();
    await saveCoachMemoryNote(user.id, payload.memoryNote);
    return NextResponse.json(publicRow(row), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Coach request failed." }, { status: 502 });
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
