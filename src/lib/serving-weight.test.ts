import assert from "node:assert/strict";
import test from "node:test";
import { savedServingWeightGrams, servingWeightGrams } from "./foods/serving-weight";

test("a serving shortcut uses the labeled mass and supports metric units and decimal commas", () => {
  assert.equal(servingWeightGrams("1 bar (50 g)"), 50);
  assert.equal(servingWeightGrams("1 stick (12,5g)"), 12.5);
  assert.equal(servingWeightGrams("0.05 kg"), 50);
  assert.equal(servingWeightGrams("500 mg"), 0.5);
});

test("a serving without a single positive mass does not get a gram shortcut", () => {
  for (const label of [null, "1 bar", "250 ml", "50 g or 75 g", "0 g", "-1 g", "1/2 g", "50–75 g", "12 g/L"]) {
    assert.equal(servingWeightGrams(label), null, label ?? "missing label");
  }
});

test("legacy favorites with the count bug display the correct weight and keep custom weights", () => {
  assert.equal(savedServingWeightGrams("1 bar (50 g)", 1), 50);
  assert.equal(savedServingWeightGrams("1 bar (50 g)", 25), 25);
  assert.equal(savedServingWeightGrams("1 cup (250 ml)", 250), 250);
  assert.equal(savedServingWeightGrams(null, 37), 37);
});
