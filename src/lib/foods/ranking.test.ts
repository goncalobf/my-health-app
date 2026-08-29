import assert from "node:assert/strict";
import test from "node:test";
import { rankAndDeduplicateFoods } from "./ranking";
import type { FoodProviderId, FoodResult } from "./types";

function food(
  provider: FoodProviderId,
  providerId: string,
  name: string,
  countryCodes: string[],
  overrides: Partial<FoodResult> = {}
): FoodResult {
  return {
    id: `${provider}:${providerId}`,
    provider,
    providerId,
    barcode: null,
    name,
    localizedNames: provider === "portfir" ? { pt: name } : { en: name },
    brand: null,
    imageUrl: null,
    category: null,
    servingSize: null,
    basisQuantity: 100,
    basisUnit: "g",
    calories: 130,
    proteinG: 2.7,
    carbsG: 28,
    fatG: 0.3,
    fiberG: null,
    sugarG: null,
    saturatedFatG: null,
    saltG: null,
    sodiumMg: null,
    countryCodes,
    source: provider,
    sourceVersion: null,
    sourceUrl: "https://example.test",
    attribution: "Test source",
    ...overrides,
  };
}

test("Portuguese official matches rank ahead of international fallback", () => {
  const foods = rankAndDeduplicateFoods(
    [
      food("usda", "1", "Rice, white, cooked", ["US"]),
      food("portfir", "2", "Arroz branco cozido", ["PT"]),
    ],
    { query: "arroz branco cozido", region: "PT", language: "pt", limit: 10 }
  );
  assert.equal(foods[0].provider, "portfir");
});

test("deduplication preserves distinct branded products", () => {
  const foods = rankAndDeduplicateFoods(
    [
      food("openfoodfacts", "1", "Greek yogurt", ["CH"], {
        barcode: "11111111",
        brand: "Brand A",
      }),
      food("openfoodfacts", "2", "Greek yogurt", ["CH"], {
        barcode: "22222222",
        brand: "Brand B",
      }),
    ],
    { query: "greek yogurt", region: "CH", language: "en", limit: 10 }
  );
  assert.equal(foods.length, 2);
});

test("the same barcode is returned only once", () => {
  const foods = rankAndDeduplicateFoods(
    [
      food("openfoodfacts", "1", "Yogurt", ["CH"], { barcode: "11111111" }),
      food("openfoodfacts", "2", "Yoghurt", ["CH"], { barcode: "11111111" }),
    ],
    { query: "yogurt", region: "CH", language: "en", limit: 10 }
  );
  assert.equal(foods.length, 1);
});
