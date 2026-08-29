import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

const DEFAULT_TARGETS = {
  targetCalories: 2200,
  targetProteinG: 160,
  targetCarbsG: 220,
  targetFatG: 70,
  goal: "recomposition",
  goalStartedOn: null,
  targetWeeklyChangePct: -0.25,
  adaptiveTargets: true,
  lastTargetReviewAt: null,
  currentWeightKg: null,
  goalWeightKg: null,
  heightCm: null,
  ageYears: null,
  biologicalSex: "unspecified",
};

export async function getTargets(userId: number) {
  const [row] = await db.select().from(settings).where(eq(settings.userId, userId));
  return row ?? { id: 0, userId, ...DEFAULT_TARGETS };
}
