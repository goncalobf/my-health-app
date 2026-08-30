import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "./foods/openfoodfacts-normalizer";

test("normalize handles Search-a-licious food results", () => {
  const food = normalize({
      code: "123",
      product_name: "Greek Yogurt",
      brands: ["Example Brand"],
      image_front_small_url: "https://images.openfoodfacts.org/example.jpg",
      serving_size: "150 g",
      nutriments: {
        "energy-kcal_100g": 72.04,
        proteins_100g: 9.96,
        carbohydrates_100g: 4.01,
        fat_100g: 1.95,
      },
    });
  assert.ok(food);
  assert.deepEqual(
    {
      id: food.id,
      provider: food.provider,
      providerId: food.providerId,
      barcode: food.barcode,
      name: food.name,
      brand: food.brand,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      servingSize: food.servingSize,
    },
    {
      id: "openfoodfacts:123",
      provider: "openfoodfacts",
      providerId: "123",
      barcode: "123",
      name: "Greek Yogurt",
      brand: "Example Brand",
      calories: 72,
      proteinG: 10,
      carbsG: 4,
      fatG: 2,
      servingSize: "150 g",
    }
  );
});

test("normalize handles current API v3.6 nutrition and localized names", () => {
  const food = normalize(
    {
      code: "3017620422003",
      product_name: "Pâte à tartiner",
      product_name_en: "Hazelnut spread",
      product_name_fr: "Pâte à tartiner",
      lang: "fr",
      nutrition: {
        aggregated_set: {
          nutrients: {
            "energy-kcal": { value: 539 },
            proteins: { value: 6.3 },
            carbohydrates: { value: 57.5 },
            fat: { value: 30.9 },
          },
        },
      },
    },
    "en"
  );
  assert.ok(food);
  assert.equal(food.name, "Hazelnut spread");
  assert.deepEqual(
    [food.calories, food.proteinG, food.carbsG, food.fatG],
    [539, 6.3, 57.5, 30.9]
  );
});

test("normalize rejects products whose labels omit a core macro", () => {
  assert.equal(
    normalize({
      code: "123",
      product_name: "Incomplete product",
      nutriments: {
        "energy-kcal_100g": 100,
        proteins_100g: 2,
        carbohydrates_100g: 10,
      },
    }),
    null
  );
});

test("normalize does not promote estimated API v3 macros to label facts", () => {
  assert.equal(
    normalize({
      code: "123",
      product_name: "Estimated product",
      nutrition: {
        aggregated_set: {
          nutrients: {
            "energy-kcal": { value: 100, source: "estimate" },
            proteins: { value: 2, source: "estimate" },
            carbohydrates: { value: 10, source: "estimate" },
            fat: { value: 4, source: "estimate" },
          },
        },
      },
    }),
    null
  );
});

test("normalize rejects products without a usable name", () => {
  assert.equal(normalize({ code: "123", nutriments: {} }), null);
});
