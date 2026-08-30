import {
  localizedFoodName,
  roundedNutrient,
  withCompleteCoreNutrition,
} from "@/lib/foods/normalization";
import type {
  FoodLanguage,
  FoodResult,
  NormalizedFood,
} from "@/lib/foods/types";

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const joined = value.filter((item) => typeof item === "string").join(", ");
    return joined || null;
  }
  return null;
}

function countryCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const mapping: Record<string, string> = {
    "en:portugal": "PT",
    "en:switzerland": "CH",
  };
  return value
    .map((item) => (typeof item === "string" ? mapping[item] : undefined))
    .filter((item): item is string => Boolean(item));
}

function v3Nutrients(product: Record<string, unknown>): Record<string, unknown> {
  const nutrition = record(product.nutrition);
  const aggregatedSet = record(nutrition.aggregated_set);
  return record(aggregatedSet.nutrients);
}

function nutrientValue(
  product: Record<string, unknown>,
  v2Key: string,
  v3Key: string
): number | null {
  const v2 = record(product.nutriments);
  if (v2[v2Key] !== undefined) return roundedNutrient(v2[v2Key]);
  const v3 = record(v3Nutrients(product)[v3Key]);
  if (v3.source === "estimate") return null;
  return roundedNutrient(v3.value);
}

export function normalize(
  payload: unknown,
  preferredLanguage: FoodLanguage = "en"
): FoodResult | null {
  const product = record(payload);
  const localizedNames: Partial<Record<FoodLanguage, string>> = {};
  for (const language of ["pt", "de", "fr", "it", "en"] as const) {
    const name = stringValue(product[`product_name_${language}`]);
    if (name) localizedNames[language] = name;
  }
  const originalName =
    stringValue(product.product_name) ??
    stringValue(product.generic_name) ??
    Object.values(localizedNames)[0] ??
    null;
  if (!originalName) return null;
  const originalLanguage = stringValue(product.lang);
  if (
    originalLanguage &&
    ["pt", "de", "fr", "it", "en"].includes(originalLanguage)
  ) {
    localizedNames[originalLanguage as FoodLanguage] ??= originalName;
  }
  const barcode = stringValue(product.code);
  const providerId = barcode ?? `name:${originalName}`;
  const normalized: NormalizedFood = {
    id: `openfoodfacts:${providerId}`,
    provider: "openfoodfacts",
    providerId,
    barcode,
    name: localizedFoodName(localizedNames, preferredLanguage, originalName),
    localizedNames,
    brand: stringValue(product.brands)?.split(",")[0]?.trim() ?? null,
    imageUrl:
      stringValue(product.image_front_small_url) ??
      stringValue(product.image_small_url),
    category: stringValue(product.categories),
    servingSize: stringValue(product.serving_size),
    basisQuantity: 100,
    basisUnit: "g",
    calories: nutrientValue(product, "energy-kcal_100g", "energy-kcal"),
    proteinG: nutrientValue(product, "proteins_100g", "proteins"),
    carbsG: nutrientValue(product, "carbohydrates_100g", "carbohydrates"),
    fatG: nutrientValue(product, "fat_100g", "fat"),
    fiberG: nutrientValue(product, "fiber_100g", "fiber"),
    sugarG: nutrientValue(product, "sugars_100g", "sugars"),
    saturatedFatG: nutrientValue(
      product,
      "saturated-fat_100g",
      "saturated-fat"
    ),
    saltG: nutrientValue(product, "salt_100g", "salt"),
    sodiumMg: (() => {
      const sodiumG = nutrientValue(product, "sodium_100g", "sodium");
      return sodiumG === null ? null : Math.round(sodiumG * 1_000 * 10) / 10;
    })(),
    countryCodes: countryCodes(product.countries_tags),
    source: "Open Food Facts",
    sourceVersion: "API v3.6 / Search-a-licious",
    sourceUrl: barcode
      ? `https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`
      : "https://world.openfoodfacts.org/",
    attribution: "Open Food Facts contributors (ODbL); product images CC BY-SA.",
  };
  return withCompleteCoreNutrition(normalized);
}
