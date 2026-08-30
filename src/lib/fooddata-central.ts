import "server-only";

import { unstable_cache } from "next/cache";
import {
  normalizeFdcFood,
  type FdcFood,
} from "@/lib/foods/fooddata-central-normalizer";
import type { FoodProvider, FoodResult } from "@/lib/foods/types";

const FDC_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];

function modifierPenalty(food: FoodResult, query: string): number {
  const description = food.name.toLowerCase();
  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  const modifiers = ["glutinous", "wild", "butter", "margarine", "oil", "frozen"];
  let penalty = 0;
  for (const modifier of modifiers) {
    if (description.includes(modifier) && !queryWords.has(modifier)) penalty += 3;
  }
  if (/ns as to|as ingredient|fast foods|fat added/.test(description)) penalty += 6;
  return penalty;
}

async function searchReferenceFoodsUncached(query: string): Promise<FoodResult[]> {
  // DEMO_KEY remains a fail-soft development fallback. Production configures a
  // dedicated server-only key with substantially higher documented limits.
  const apiKey = process.env.FDC_API_KEY?.trim() || "DEMO_KEY";
  const response = await fetch(`${FDC_URL}?api_key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      dataType: DATA_TYPES,
      pageSize: 24,
      pageNumber: 1,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`USDA FoodData Central search failed (${response.status}).`);
  }
  const payload = (await response.json()) as { foods?: FdcFood[] };
  return (payload.foods ?? [])
    .map(normalizeFdcFood)
    .filter((food): food is FoodResult => food !== null)
    .map((food, index) => ({ food, index, penalty: modifierPenalty(food, query) }))
    .sort((a, b) => a.penalty - b.penalty || a.index - b.index)
    .map(({ food }) => food);
}

const cachedSearchReferenceFoods = unstable_cache(
  searchReferenceFoodsUncached,
  ["food-provider", "usda", "search", "v2"],
  { revalidate: 21_600 }
);

export function searchReferenceFoods(query: string): Promise<FoodResult[]> {
  return cachedSearchReferenceFoods(query.trim().toLowerCase());
}

export const foodDataCentralProvider: FoodProvider = {
  id: "usda",
  search: ({ query }) => searchReferenceFoods(query),
};

export { normalizeFdcFood } from "@/lib/foods/fooddata-central-normalizer";
