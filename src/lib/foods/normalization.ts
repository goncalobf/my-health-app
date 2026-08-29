import type {
  FoodLanguage,
  FoodResult,
  NormalizedFood,
} from "@/lib/foods/types";

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function roundedNutrient(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0
    ? Math.round(number * 10) / 10
    : null;
}

export function localizedFoodName(
  names: Partial<Record<FoodLanguage, string>>,
  preferred: FoodLanguage,
  fallback: string
): string {
  return names[preferred] ?? names.en ?? names.pt ?? Object.values(names)[0] ?? fallback;
}

export function withCompleteCoreNutrition(
  food: NormalizedFood
): FoodResult | null {
  const core = [food.calories, food.proteinG, food.carbsG, food.fatG];
  if (core.some((value) => value === null || !Number.isFinite(value))) return null;
  if (
    food.calories! > 1_200 ||
    food.proteinG! > 100 ||
    food.carbsG! > 100 ||
    food.fatG! > 100
  ) {
    return null;
  }
  return food as FoodResult;
}

export function parseServingGrams(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (!match) return null;
  const grams = Number(match[1].replace(",", "."));
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}
