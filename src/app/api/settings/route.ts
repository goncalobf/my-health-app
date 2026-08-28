import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

async function getOrCreate() {
  const [existing] = await db
    .select()
    .from(settings)
    .where(eq(settings.id, 1));
  if (existing) return existing;
  const [created] = await db.insert(settings).values({ id: 1 }).returning();
  return created;
}

export async function GET() {
  return NextResponse.json(await getOrCreate());
}

export async function PATCH(req: Request) {
  await getOrCreate();
  const body = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = {};
  if (body.targetCalories !== undefined)
    set.targetCalories = Number(body.targetCalories);
  if (body.targetProteinG !== undefined)
    set.targetProteinG = Number(body.targetProteinG);
  if (body.targetCarbsG !== undefined)
    set.targetCarbsG = Number(body.targetCarbsG);
  if (body.targetFatG !== undefined) set.targetFatG = Number(body.targetFatG);
  if (body.goal !== undefined) set.goal = String(body.goal);
  if (body.targetWeeklyChangePct !== undefined)
    set.targetWeeklyChangePct = Number(body.targetWeeklyChangePct);
  if (body.adaptiveTargets !== undefined)
    set.adaptiveTargets = !!body.adaptiveTargets;
  if (body.reviewAdaptiveTarget === true) set.lastTargetReviewAt = new Date();
  if (body.goalWeightKg !== undefined)
    set.goalWeightKg = body.goalWeightKg === "" || body.goalWeightKg == null ? null : Number(body.goalWeightKg);

  const [row] = await db
    .update(settings)
    .set(set)
    .where(eq(settings.id, 1))
    .returning();
  return NextResponse.json(row);
}
