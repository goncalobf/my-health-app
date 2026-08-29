import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFdcFood } from "./fooddata-central";

test("normalizeFdcFood maps USDA macros per 100 grams", () => {
  assert.deepEqual(
    normalizeFdcFood({
      fdcId: 2708408,
      description: "Rice, white, cooked, no added fat",
      dataType: "Survey (FNDDS)",
      foodNutrients: [
        { nutrientId: 1008, nutrientName: "Energy", unitName: "KCAL", value: 129 },
        { nutrientId: 1003, nutrientName: "Protein", unitName: "G", value: 2.67 },
        { nutrientId: 1004, nutrientName: "Total lipid (fat)", unitName: "G", value: 0.28 },
        { nutrientId: 1005, nutrientName: "Carbohydrate, by difference", unitName: "G", value: 27.99 },
      ],
    }),
    {
      barcode: null,
      name: "Rice, white, cooked, no added fat",
      brand: "Survey (FNDDS)",
      imageUrl: null,
      calories: 129,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
      servingSize: null,
      source: "USDA FoodData Central",
      sourceId: "2708408",
    }
  );
});

test("normalizeFdcFood rejects entries without an id or name", () => {
  assert.equal(normalizeFdcFood({ description: "Rice" }), null);
  assert.equal(normalizeFdcFood({ fdcId: 1 }), null);
});
