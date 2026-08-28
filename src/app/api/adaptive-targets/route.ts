import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bodyweightLogs, expenditureLogs, nutritionLogs, settings } from "@/db/schema";
import { shiftISODate, todayISO } from "@/lib/utils";

const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

export async function GET() {
  const [setting] = await db.select().from(settings).where(eq(settings.id, 1));
  const weights = await db.select().from(bodyweightLogs).orderBy(asc(bodyweightLogs.day));
  const burns = await db.select().from(expenditureLogs).orderBy(asc(expenditureLogs.day));
  const intake = await db.select().from(nutritionLogs).orderBy(asc(nutritionLogs.day));
  const cutoff = shiftISODate(todayISO(), -13);
  const recentBurns = burns.filter((x) => x.day >= cutoff);
  const recentIntake = intake.filter((x) => x.day >= cutoff);

  // Multiple weigh-ins on one day should count as one daily signal. Average
  // them so accidental duplicate entries cannot skew the target review.
  const weightDays = weights
    .filter((x) => x.day >= cutoff)
    .reduce<Map<string, number[]>>((days, row) => {
      days.set(row.day, [...(days.get(row.day) ?? []), row.weightKg]);
      return days;
    }, new Map());
  const recentWeights = [...weightDays].map(([day, values]) => ({
    day,
    weightKg: average(values),
  }));
  const intakeDays = new Set(recentIntake.map((x) => x.day)).size;
  if (!setting?.adaptiveTargets) {
    return NextResponse.json({ ready: false, message: "Adaptive targets are disabled." });
  }
  if (setting.lastTargetReviewAt && Date.now() - new Date(setting.lastTargetReviewAt).getTime() < 14 * 86_400_000) {
    return NextResponse.json({ ready: false, message: "The next target review will be ready two weeks after the last one." });
  }
  if (recentWeights.length < 4 || recentBurns.length < 10 || intakeDays < 10) {
    return NextResponse.json({ ready: false, message: "In the last 14 days, log at least 10 days of food and Garmin calories, plus 4 weigh-ins." });
  }

  const split = Math.max(2, Math.floor(recentWeights.length / 2));
  const earlier = recentWeights.slice(0, split);
  const later = recentWeights.slice(split);
  const earlierAvg = average(earlier.map((x) => x.weightKg));
  const laterAvg = average(later.map((x) => x.weightKg));
  const center = (rows: { day: string }[]) => average(rows.map((x) => new Date(`${x.day}T00:00:00Z`).getTime()));
  const daysBetween = Math.max(1, (center(later) - center(earlier)) / 86_400_000);
  const observedWeeklyKg = (laterAvg - earlierAvg) * (7 / daysBetween);
  const desiredWeeklyKg = laterAvg * (setting.targetWeeklyChangePct / 100);

  const recentBurn = average(recentBurns.map((x) => x.totalCalories));
  const byGarmin = recentBurn + (desiredWeeklyKg * 7700) / 7;
  const trendCorrection = Math.max(-150, Math.min(150, -(observedWeeklyKg - desiredWeeklyKg) * 1100));
  const proposedCalories = Math.round(Math.max(1200, (byGarmin + trendCorrection) / 10) * 10);
  const proteinG = Math.round(laterAvg * 2);
  const fatG = Math.round((proposedCalories * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((proposedCalories - proteinG * 4 - fatG * 9) / 4));

  const intakeByDay = recentIntake.reduce<Record<string, number>>((days, x) => {
    days[x.day] = (days[x.day] ?? 0) + x.calories;
    return days;
  }, {});
  const avgIntake = average(Object.values(intakeByDay));

  return NextResponse.json({
    ready: true,
    proposed: { targetCalories: proposedCalories, targetProteinG: proteinG, targetCarbsG: carbsG, targetFatG: fatG },
    current: { targetCalories: setting.targetCalories, targetProteinG: setting.targetProteinG, targetCarbsG: setting.targetCarbsG, targetFatG: setting.targetFatG },
    evidence: { averageGarminCalories: Math.round(recentBurn), averageIntake: Math.round(avgIntake), observedWeeklyKg: Math.round(observedWeeklyKg * 100) / 100, desiredWeeklyKg: Math.round(desiredWeeklyKg * 100) / 100 },
  });
}
