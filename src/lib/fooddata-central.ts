import type { FoodResult } from "@/lib/openfoodfacts";

const FDC_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";
const DATA_TYPES = ["Foundation", "SR Legacy", "Survey (FNDDS)"];
const CACHE_TTL_MS = 30 * 60 * 1000;

interface FdcNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

interface FdcFood {
  fdcId?: number;
  description?: string;
  dataType?: string;
  foodNutrients?: FdcNutrient[];
}

const cache = new Map<string, { expiresAt: number; foods: FoodResult[] }>();

function rounded(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : 0;
}

function nutrient(food: FdcFood, ids: number[], names: RegExp): number {
  const nutrients = food.foodNutrients ?? [];
  const matchById = ids
    .map((id) => nutrients.find((item) => item.nutrientId === id))
    .find(Boolean);
  const match = matchById ?? nutrients.find((item) =>
    names.test(item.nutrientName ?? "") && item.unitName?.toUpperCase() !== "KJ"
  );
  return rounded(match?.value);
}

export function normalizeFdcFood(food: FdcFood): FoodResult | null {
  const name = food.description?.trim();
  if (!name || !food.fdcId) return null;

  return {
    barcode: null,
    name,
    brand: food.dataType ?? null,
    imageUrl: null,
    calories: nutrient(food, [1008, 2047, 2048], /^energy/i),
    proteinG: nutrient(food, [1003], /^protein$/i),
    carbsG: nutrient(food, [1005], /carbohydrate, by difference/i),
    fatG: nutrient(food, [1004], /^total lipid \(fat\)$/i),
    servingSize: null,
    source: "USDA FoodData Central",
    sourceId: String(food.fdcId),
  };
}

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

function rankFoods(foods: FoodResult[], query: string): FoodResult[] {
  return foods
    .map((food, index) => ({ food, index, penalty: modifierPenalty(food, query) }))
    .sort((a, b) => a.penalty - b.penalty || a.index - b.index)
    .map(({ food }) => food);
}

export async function searchReferenceFoods(query: string): Promise<FoodResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const cached = cache.get(normalizedQuery);
  if (cached && cached.expiresAt > Date.now()) return cached.foods;

  // DEMO_KEY makes the feature work immediately for a personal app. A dedicated
  // data.gov key should be configured for production traffic to raise its limits.
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
  const foods = rankFoods(
    (payload.foods ?? [])
      .map(normalizeFdcFood)
      .filter((food): food is FoodResult => food !== null),
    query
  );
  cache.set(normalizedQuery, { expiresAt: Date.now() + CACHE_TTL_MS, foods });
  return foods;
}
