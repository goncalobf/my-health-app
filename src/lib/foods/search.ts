import "server-only";

import { createCatalogProvider } from "@/lib/foods/catalog-provider";
import { rankAndDeduplicateFoods } from "@/lib/foods/ranking";
import type {
  FoodLanguage,
  FoodProvider,
  FoodRegion,
  FoodResult,
} from "@/lib/foods/types";
import { foodDataCentralProvider } from "@/lib/fooddata-central";
import { openFoodFactsProvider } from "@/lib/openfoodfacts";

const providers: FoodProvider[] = [
  createCatalogProvider("portfir"),
  createCatalogProvider("swiss"),
  foodDataCentralProvider,
  openFoodFactsProvider,
];

export interface ProviderSearchStatus {
  provider: FoodProvider["id"];
  ok: boolean;
}

export async function searchAllFoodProviders(input: {
  query: string;
  region: FoodRegion;
  language: FoodLanguage;
  limit?: number;
}): Promise<{ foods: FoodResult[]; providers: ProviderSearchStatus[] }> {
  const context = {
    ...input,
    limit: input.limit ?? 36,
  };
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.search(context))
  );
  const statuses = settled.map((result, index) => ({
    provider: providers[index].id,
    ok: result.status === "fulfilled",
  }));
  const foods = settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
  return {
    foods: rankAndDeduplicateFoods(foods, context),
    providers: statuses,
  };
}

export async function lookupFoodBarcode(input: {
  code: string;
  region: FoodRegion;
  language: FoodLanguage;
}): Promise<FoodResult | null> {
  return openFoodFactsProvider.lookupBarcode?.(input.code, input) ?? null;
}
