import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bodyweightLogs, settings } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { calculateMacroTargets } from "@/lib/macro-targets";
import {
  estimateCalorieTarget,
  type BiologicalSex,
  type Goal,
} from "@/lib/calorie-targets";
import { todayISO } from "@/lib/utils";

const GOALS: Goal[] = [
  "fat_loss",
  "recomposition",
  "maintenance",
  "muscle_gain",
];
const SEXES: BiologicalSex[] = ["male", "female", "unspecified"];

function bounded(value: unknown, min: number, max: number): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));

  const goal = GOALS.includes(body.goal) ? (body.goal as Goal) : null;
  const biologicalSex = SEXES.includes(body.biologicalSex)
    ? (body.biologicalSex as BiologicalSex)
    : null;
  const currentWeightKg = bounded(body.currentWeightKg, 20, 400);
  const heightCm = bounded(body.heightCm, 80, 260);
  const ageYears = bounded(body.ageYears, 13, 100);
  const goalWeightKg =
    body.goalWeightKg == null || body.goalWeightKg === ""
      ? null
      : bounded(body.goalWeightKg, 20, 400);

  if (!goal || !biologicalSex || !currentWeightKg || !heightCm || !ageYears) {
    return NextResponse.json(
      { error: "Enter a goal, weight, height, age and sex to continue." },
      { status: 400 }
    );
  }
  if (body.goalWeightKg != null && body.goalWeightKg !== "" && !goalWeightKg) {
    return NextResponse.json(
      { error: "That goal weight is outside the supported range." },
      { status: 400 }
    );
  }

  const estimate = estimateCalorieTarget({
    currentWeightKg,
    heightCm,
    ageYears: Math.round(ageYears),
    biologicalSex,
    goal,
  });
  const macros = calculateMacroTargets({
    targetCalories: estimate.targetCalories,
    currentWeightKg,
    goal,
  });

  const today = todayISO();
  const [saved] = await db
    .update(settings)
    .set({
      goal,
      goalStartedOn: today,
      currentWeightKg,
      goalWeightKg,
      heightCm,
      ageYears: Math.round(ageYears),
      biologicalSex,
      targetCalories: estimate.targetCalories,
      targetWeeklyChangePct: estimate.targetWeeklyChangePct,
      targetProteinG: macros.targetProteinG,
      targetCarbsG: macros.targetCarbsG,
      targetFatG: macros.targetFatG,
      onboardedAt: new Date(),
    })
    .where(eq(settings.userId, user.id))
    .returning({ id: settings.id });

  if (!saved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Seed the weight trend so progress has a starting point.
  const [existingToday] = await db
    .select({ id: bodyweightLogs.id })
    .from(bodyweightLogs)
    .where(
      and(eq(bodyweightLogs.userId, user.id), eq(bodyweightLogs.day, today))
    );
  if (!existingToday) {
    await db
      .insert(bodyweightLogs)
      .values({ userId: user.id, day: today, weightKg: currentWeightKg });
  }

  return NextResponse.json({
    targetCalories: estimate.targetCalories,
    targetProteinG: macros.targetProteinG,
    targetCarbsG: macros.targetCarbsG,
    targetFatG: macros.targetFatG,
  });
}
