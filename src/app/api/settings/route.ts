import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { shiftISODate, todayISO } from "@/lib/utils";

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
  const nullableNumber = (value: unknown) =>
    value === "" || value == null ? null : Number(value);
  if (body.targetCalories !== undefined)
    set.targetCalories = Number(body.targetCalories);
  if (body.targetProteinG !== undefined)
    set.targetProteinG = Number(body.targetProteinG);
  if (body.targetCarbsG !== undefined)
    set.targetCarbsG = Number(body.targetCarbsG);
  if (body.targetFatG !== undefined) set.targetFatG = Number(body.targetFatG);
  if (body.goal !== undefined) set.goal = String(body.goal);
  if (body.goalStartedOn !== undefined) {
    const day = body.goalStartedOn ? String(body.goalStartedOn) : null;
    if (
      day !== null &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        shiftISODate(day, 0) !== day ||
        day > todayISO())
    ) {
      return NextResponse.json(
        { error: "Enter a valid phase start date that is not in the future." },
        { status: 400 }
      );
    }
    set.goalStartedOn = day;
  }
  if (body.targetWeeklyChangePct !== undefined)
    set.targetWeeklyChangePct = Number(body.targetWeeklyChangePct);
  if (body.adaptiveTargets !== undefined)
    set.adaptiveTargets = !!body.adaptiveTargets;
  if (body.reviewAdaptiveTarget === true) set.lastTargetReviewAt = new Date();
  if (body.goalWeightKg !== undefined)
    set.goalWeightKg = nullableNumber(body.goalWeightKg);
  if (body.currentWeightKg !== undefined)
    set.currentWeightKg = nullableNumber(body.currentWeightKg);
  if (body.heightCm !== undefined)
    set.heightCm = nullableNumber(body.heightCm);
  if (body.ageYears !== undefined)
    set.ageYears = nullableNumber(body.ageYears);
  if (body.biologicalSex !== undefined) {
    const sex = String(body.biologicalSex);
    set.biologicalSex = ["male", "female", "unspecified"].includes(sex)
      ? sex
      : "unspecified";
  }

  const invalid = Object.values(set).some(
    (value) => typeof value === "number" && !Number.isFinite(value)
  );
  if (invalid) {
    return NextResponse.json({ error: "Enter valid numeric values." }, { status: 400 });
  }

  const outOfRange = (
    key: string,
    min: number,
    max: number
  ) =>
    typeof set[key] === "number" &&
    ((set[key] as number) < min || (set[key] as number) > max);
  if (
    outOfRange("currentWeightKg", 30, 400) ||
    outOfRange("goalWeightKg", 30, 400) ||
    outOfRange("heightCm", 100, 250) ||
    outOfRange("ageYears", 18, 100)
  ) {
    return NextResponse.json(
      { error: "Check the profile values and try again." },
      { status: 400 }
    );
  }
  if (
    outOfRange("targetCalories", 1200, 6000) ||
    outOfRange("targetProteinG", 0, 350) ||
    outOfRange("targetCarbsG", 0, 900) ||
    outOfRange("targetFatG", 20, 250) ||
    outOfRange("targetWeeklyChangePct", -2, 2)
  ) {
    return NextResponse.json(
      { error: "Check the goal and target values and try again." },
      { status: 400 }
    );
  }

  const [row] = await db
    .update(settings)
    .set(set)
    .where(eq(settings.id, 1))
    .returning();
  return NextResponse.json(row);
}
