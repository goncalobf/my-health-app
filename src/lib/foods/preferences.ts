import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import {
  FOOD_LANGUAGES,
  FOOD_REGIONS,
  type FoodLanguage,
  type FoodRegion,
} from "@/lib/foods/types";

export async function getFoodSearchPreferences(userId: number): Promise<{
  region: FoodRegion;
  language: FoodLanguage;
}> {
  const [preferences] = await db
    .select({
      region: settings.foodRegion,
      language: settings.foodLanguage,
    })
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);
  return {
    region: FOOD_REGIONS.includes(preferences?.region as FoodRegion)
      ? (preferences.region as FoodRegion)
      : "both",
    language: FOOD_LANGUAGES.includes(preferences?.language as FoodLanguage)
      ? (preferences.language as FoodLanguage)
      : "pt",
  };
}
