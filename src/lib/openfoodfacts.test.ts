import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "./openfoodfacts";

test("normalize handles Search-a-licious food results", () => {
  assert.deepEqual(
    normalize({
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
    }),
    {
      barcode: "123",
      name: "Greek Yogurt",
      brand: "Example Brand",
      imageUrl: "https://images.openfoodfacts.org/example.jpg",
      calories: 72,
      proteinG: 10,
      carbsG: 4,
      fatG: 2,
      servingSize: "150 g",
      source: "Open Food Facts",
      sourceId: "123",
    }
  );
});

test("normalize rejects products without a usable name", () => {
  assert.equal(normalize({ code: "123", nutriments: {} }), null);
});
