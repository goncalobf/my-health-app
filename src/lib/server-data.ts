import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

const DEFAULT_TARGETS = {
  targetCalories: 2200,
  targetProteinG: 160,
  targetCarbsG: 220,
  targetFatG: 70,
  goal: "recomposition",
  targetWeeklyChangePct: -0.25,
  adaptiveTargets: true,
  lastTargetReviewAt: null,
  goalWeightKg: null,
};

export async function getTargets() {
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return row ?? { id: 1, ...DEFAULT_TARGETS };
}
