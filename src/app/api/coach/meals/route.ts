import { NextResponse } from "next/server";
import { db } from "@/db";
import { coachInsights } from "@/db/schema";
import { CoachMealPayload, mealSchema } from "@/lib/coach";
import { getCoachSnapshot } from "@/lib/coach-data";
import { formatCoachSnapshotAsMarkdown } from "@/lib/coach-snapshot-markdown";
import { COACH_MODEL, isCoachConfigured, structuredCoachResponse } from "@/lib/openai";
import { todayISO } from "@/lib/utils";
import { requireAppUser } from "@/lib/app-user";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const user = await requireAppUser();
  if (!isCoachConfigured()) return NextResponse.json({ error: "Add OPENAI_API_KEY in Vercel to enable Fitlog Coach." }, { status: 503 });
  if (isRateLimited(`coach-meals:${user.id}`, { max: 20, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const meal = typeof body?.meal === "string" ? body.meal.trim().slice(0, 40) || "next meal" : "next meal";
  const snapshot = await getCoachSnapshot({ userId: user.id, days: 14 });
  try {
    const payload = await structuredCoachResponse<CoachMealPayload>({
      name: "fitlog_meal_ideas", schema: mealSchema,
      data: `## Requested meal\n${meal}\n\n${formatCoachSnapshotAsMarkdown(snapshot)}`,
    });
    await db.insert(coachInsights).values({
      userId: user.id,
      kind: "meal", sourceKey: `meal:${todayISO()}:${Date.now()}`,
      payloadJson: JSON.stringify(payload), model: COACH_MODEL,
    });
    return NextResponse.json(payload, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Coach request failed. Try again." }, { status: 502 });
  }
}
