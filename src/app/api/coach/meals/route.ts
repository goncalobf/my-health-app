import { NextResponse } from "next/server";
import { db } from "@/db";
import { coachInsights } from "@/db/schema";
import { CoachMealPayload, mealSchema } from "@/lib/coach";
import { getCoachSnapshot } from "@/lib/coach-data";
import { COACH_MODEL, isCoachConfigured, structuredCoachResponse } from "@/lib/openai";
import { todayISO } from "@/lib/utils";

export async function POST(req: Request) {
  if (!isCoachConfigured()) return NextResponse.json({ error: "Add OPENAI_API_KEY in Vercel to enable Fitlog Coach." }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const meal = String(body.meal || "next meal").slice(0, 40);
  const snapshot = await getCoachSnapshot({ days: 14 });
  try {
    const payload = await structuredCoachResponse<CoachMealPayload>({
      name: "fitlog_meal_ideas", schema: mealSchema,
      task: `Suggest 2-4 realistic ideas for the user's ${meal}. Use today's remaining macros as a direction, prefer familiar foods when helpful, keep grams as the primary quantity, and label all macros as estimates. Never suggest compensatory restriction when targets were exceeded.`,
      data: snapshot,
    });
    await db.insert(coachInsights).values({
      kind: "meal", sourceKey: `meal:${todayISO()}:${Date.now()}`,
      payloadJson: JSON.stringify(payload), model: COACH_MODEL,
    });
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Coach request failed." }, { status: 502 });
  }
}
