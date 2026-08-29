import { NextResponse } from "next/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { bodyweightLogs, settings } from "@/db/schema";
import { buildNutritionPhase } from "@/lib/nutrition-phase";
import { shiftISODate, todayISO } from "@/lib/utils";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  const today = todayISO();
  const [setting] = await db.select().from(settings).where(eq(settings.userId, user.id));
  const weights = await db
    .select({ day: bodyweightLogs.day, weightKg: bodyweightLogs.weightKg })
    .from(bodyweightLogs)
    .where(and(eq(bodyweightLogs.userId, user.id), gte(bodyweightLogs.day, shiftISODate(today, -27))))
    .orderBy(asc(bodyweightLogs.day));

  return NextResponse.json(
    buildNutritionPhase({
      goal: setting?.goal ?? "recomposition",
      startedOn: setting?.goalStartedOn ?? null,
      today,
      targetWeeklyChangePct: setting?.targetWeeklyChangePct ?? -0.25,
      weights,
    })
  );
}
