import type { FoodResult, FoodSearchContext } from "@/lib/foods/types";
import { normalizeSearchText } from "@/lib/foods/normalization";

const PREPARATION_WORDS = new Set([
  "cozido",
  "cozida",
  "cozinhado",
  "cozinhada",
  "grelhado",
  "grelhada",
  "cooked",
  "boiled",
  "grilled",
  "gegart",
  "gekocht",
  "gegrillt",
  "cuit",
  "cuite",
  "grille",
  "grillee",
  "cotto",
  "cotta",
  "grigliato",
  "grigliata",
]);

function regionalScore(food: FoodResult, context: FoodSearchContext): number {
  if (context.region === "PT" && food.countryCodes.includes("PT")) return 45;
  if (context.region === "CH" && food.countryCodes.includes("CH")) return 45;
  if (
    context.region === "both" &&
    food.countryCodes.some((code) => code === "PT" || code === "CH")
  ) {
    return 38;
  }
  return food.provider === "usda" ? 12 : 0;
}

export function foodRelevanceScore(
  food: FoodResult,
  context: FoodSearchContext
): number {
  const query = normalizeSearchText(context.query);
  const queryTokens = query.split(" ").filter(Boolean);
  const names = [food.name, ...Object.values(food.localizedNames)]
    .filter((name): name is string => Boolean(name))
    .map(normalizeSearchText);
  const preferredName = food.localizedNames[context.language];
  const searchable = normalizeSearchText(`${names.join(" ")} ${food.brand ?? ""}`);
  const category = normalizeSearchText(food.category ?? "");

  let score = regionalScore(food, context);
  if (names.includes(query)) score += 120;
  if (names.some((name) => name.startsWith(query))) score += 70;
  if (queryTokens.every((token) => searchable.includes(token))) score += 45;
  score += queryTokens.filter((token) => searchable.includes(token)).length * 8;
  score += queryTokens.filter((token) => category.includes(token)).length;
  if (preferredName && normalizeSearchText(preferredName).includes(query)) score += 18;

  const preparationTokens = queryTokens.filter((token) => PREPARATION_WORDS.has(token));
  if (
    preparationTokens.length > 0 &&
    preparationTokens.every((token) => searchable.includes(token))
  ) {
    score += 24;
  }

  if (food.provider === "portfir" || food.provider === "swiss") score += 20;
  else if (food.provider === "usda") score += 12;
  else score += 5;
  if (food.fiberG !== null) score += 2;
  if (food.sugarG !== null) score += 1;
  return score;
}

function macrosNear(a: FoodResult, b: FoodResult): boolean {
  return (
    Math.abs(a.calories - b.calories) <= 5 &&
    Math.abs(a.proteinG - b.proteinG) <= 1 &&
    Math.abs(a.carbsG - b.carbsG) <= 1 &&
    Math.abs(a.fatG - b.fatG) <= 1
  );
}

export function rankAndDeduplicateFoods(
  foods: FoodResult[],
  context: FoodSearchContext
): FoodResult[] {
  const ranked = foods
    .map((food, index) => ({
      food,
      index,
      score: foodRelevanceScore(food, context),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const accepted: FoodResult[] = [];
  const barcodes = new Set<string>();

  for (const { food } of ranked) {
    if (food.barcode && barcodes.has(food.barcode)) continue;
    const name = normalizeSearchText(food.name);
    const brand = normalizeSearchText(food.brand ?? "");
    const duplicate = accepted.some((existing) => {
      if (food.brand || existing.brand) {
        return (
          name === normalizeSearchText(existing.name) &&
          brand === normalizeSearchText(existing.brand ?? "")
        );
      }
      return name === normalizeSearchText(existing.name) && macrosNear(food, existing);
    });
    if (duplicate) continue;
    accepted.push(food);
    if (food.barcode) barcodes.add(food.barcode);
    if (accepted.length >= context.limit) break;
  }
  return accepted;
}
