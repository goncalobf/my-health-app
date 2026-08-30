import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFdcFood } from "./foods/fooddata-central-normalizer";

test("normalizeFdcFood maps USDA macros per 100 grams", () => {
  const food = normalizeFdcFood({
      fdcId: 2708408,
      description: "Rice, white, cooked, no added fat",
      dataType: "Survey (FNDDS)",
      foodNutrients: [
        { nutrientId: 1008, nutrientName: "Energy", unitName: "KCAL", value: 129 },
        { nutrientId: 1003, nutrientName: "Protein", unitName: "G", value: 2.67 },
        { nutrientId: 1004, nutrientName: "Total lipid (fat)", unitName: "G", value: 0.28 },
        { nutrientId: 1005, nutrientName: "Carbohydrate, by difference", unitName: "G", value: 27.99 },
      ],
    });
  assert.ok(food);
  assert.deepEqual(
    {
      id: food.id,
      provider: food.provider,
      providerId: food.providerId,
      name: food.name,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      basisQuantity: food.basisQuantity,
      basisUnit: food.basisUnit,
    },
    {
      id: "usda:2708408",
      provider: "usda",
      providerId: "2708408",
      name: "Rice, white, cooked, no added fat",
      calories: 129,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
      basisQuantity: 100,
      basisUnit: "g",
    }
  );
});

test("normalizeFdcFood rejects foods with incomplete core macros", () => {
  assert.equal(
    normalizeFdcFood({
      fdcId: 1,
      description: "Incomplete food",
      foodNutrients: [
        { nutrientId: 1008, unitName: "KCAL", value: 100 },
        { nutrientId: 1003, unitName: "G", value: 3 },
      ],
    }),
    null
  );
});

test("normalizeFdcFood rejects entries without an id or name", () => {
  assert.equal(normalizeFdcFood({ description: "Rice" }), null);
  assert.equal(normalizeFdcFood({ fdcId: 1 }), null);
});
