import "server-only";

import { and, eq, ilike, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { foodCatalogItems, foodCatalogNames } from "@/db/schema";
import {
  localizedFoodName,
  normalizeSearchText,
  withCompleteCoreNutrition,
} from "@/lib/foods/normalization";
import type {
  FoodLanguage,
  FoodProvider,
  FoodProviderId,
  FoodResult,
  NormalizedFood,
} from "@/lib/foods/types";

const PROVIDER_LABELS: Record<"portfir" | "swiss", string> = {
  portfir: "PortFIR · INSA",
  swiss: "Swiss Food Composition Database · FSVO",
};

export function createCatalogProvider(
  provider: Extract<FoodProviderId, "portfir" | "swiss">
): FoodProvider {
  return {
    id: provider,
    async search(context): Promise<FoodResult[]> {
      const tokens = normalizeSearchText(context.query).split(" ").filter(Boolean);
      if (tokens.length === 0) return [];

      const matches = await db
        .select({ item: foodCatalogItems })
        .from(foodCatalogNames)
        .innerJoin(
          foodCatalogItems,
          eq(foodCatalogNames.foodId, foodCatalogItems.id)
        )
        .where(
          and(
            eq(foodCatalogItems.provider, provider),
            ...tokens.map((token) =>
              ilike(foodCatalogNames.searchText, `%${token}%`)
            )
          )
        )
        // The importer puts name and synonyms before category text. Ordering
        // by the first match keeps direct food-name hits ahead of broad
        // category matches before the richer application ranking runs.
        .orderBy(
          sql`position(${tokens[0]} in ${foodCatalogNames.searchText})`,
          sql`char_length(${foodCatalogNames.searchText})`
        )
        .limit(Math.max(context.limit * 6, 240));

      const items = Array.from(
        new Map(matches.map(({ item }) => [item.id, item])).values()
      );
      if (items.length === 0) return [];
      const nameRows = await db
        .select()
        .from(foodCatalogNames)
        .where(inArray(foodCatalogNames.foodId, items.map((item) => item.id)));
      const namesByFood = new Map<
        number,
        Partial<Record<FoodLanguage, string>>
      >();
      for (const row of nameRows) {
        const names = namesByFood.get(row.foodId) ?? {};
        if (["pt", "de", "fr", "it", "en"].includes(row.language)) {
          names[row.language as FoodLanguage] = row.name;
        }
        namesByFood.set(row.foodId, names);
      }

      return items
        .map((item) => {
          const localizedNames = namesByFood.get(item.id) ?? {};
          const fallbackName = Object.values(localizedNames)[0];
          if (!fallbackName || item.basisQuantity !== 100 || item.basisUnit !== "g") {
            return null;
          }
          const food: NormalizedFood = {
            id: `${provider}:${item.providerId}`,
            provider,
            providerId: item.providerId,
            barcode: null,
            name: localizedFoodName(
              localizedNames,
              context.language,
              fallbackName
            ),
            localizedNames,
            brand: null,
            imageUrl: null,
            category: item.category,
            servingSize: null,
            basisQuantity: 100,
            basisUnit: "g",
            calories: item.caloriesKcal,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatG: item.fatG,
            fiberG: item.fiberG,
            sugarG: item.sugarG,
            saturatedFatG: item.saturatedFatG,
            saltG: item.saltG,
            sodiumMg: item.sodiumMg,
            countryCodes: [item.countryCode],
            source: PROVIDER_LABELS[provider],
            sourceVersion: item.sourceVersion,
            sourceUrl: item.sourceUrl,
            attribution: item.attribution,
          };
          return withCompleteCoreNutrition(food);
        })
        .filter((food): food is FoodResult => food !== null);
    },
  };
}
