import {
  roundedNutrient,
  withCompleteCoreNutrition,
} from "@/lib/foods/normalization";
import type { FoodResult, NormalizedFood } from "@/lib/foods/types";

export interface FdcNutrient {
  nutrientId?: number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

export interface FdcFood {
  fdcId?: number;
  description?: string;
  dataType?: string;
  foodNutrients?: FdcNutrient[];
}

function nutrient(food: FdcFood, ids: number[], names: RegExp): number | null {
  const nutrients = food.foodNutrients ?? [];
  const matchById = ids
    .map((id) => nutrients.find((item) => item.nutrientId === id))
    .find(Boolean);
  const match =
    matchById ??
    nutrients.find(
      (item) =>
        names.test(item.nutrientName ?? "") &&
        item.unitName?.toUpperCase() !== "KJ"
    );
  return roundedNutrient(match?.value);
}

export function normalizeFdcFood(food: FdcFood): FoodResult | null {
  const name = food.description?.trim();
  if (!name || !food.fdcId) return null;
  const providerId = String(food.fdcId);
  const normalized: NormalizedFood = {
    id: `usda:${providerId}`,
    provider: "usda",
    providerId,
    barcode: null,
    name,
    localizedNames: { en: name },
    brand: null,
    imageUrl: null,
    category: food.dataType ?? null,
    servingSize: null,
    basisQuantity: 100,
    basisUnit: "g",
    calories: nutrient(food, [1008, 2047, 2048], /^energy/i),
    proteinG: nutrient(food, [1003], /^protein$/i),
    carbsG: nutrient(food, [1005], /carbohydrate, by difference/i),
    fatG: nutrient(food, [1004], /^total lipid \(fat\)$/i),
    fiberG: nutrient(food, [1079], /^fiber/i),
    sugarG: nutrient(food, [2000], /^total sugars/i),
    saturatedFatG: nutrient(food, [1258], /^fatty acids, total saturated/i),
    saltG: null,
    sodiumMg: nutrient(food, [1093], /^sodium/i),
    countryCodes: ["US"],
    source: "USDA FoodData Central",
    sourceVersion: null,
    sourceUrl: `https://fdc.nal.usda.gov/food-details/${providerId}/nutrients`,
    attribution: "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central.",
  };
  return withCompleteCoreNutrition(normalized);
}
