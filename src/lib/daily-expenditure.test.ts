import assert from "node:assert/strict";
import test from "node:test";
import { dailyExpenditure, dailyExpenditureTrend } from "./daily-expenditure";

test("Coach and Home prioritize a synced Garmin reading and preserve zero", () => {
  assert.deepEqual(dailyExpenditure(0, 2500), { totalCalories: 0, source: "Garmin sync" });
  assert.deepEqual(dailyExpenditure(null, 2400), { totalCalories: 2400, source: "Manual log" });
  assert.equal(dailyExpenditure(null, null), null);
});

test("the Coach trend combines synced and logged days without double-counting", () => {
  assert.deepEqual(
    dailyExpenditureTrend([
      { date: "2026-11-25", caloriesTotal: null },
      { date: "2026-11-26", caloriesTotal: 2412 },
      { date: "2026-11-27", caloriesTotal: 1810 },
      { date: "2026-11-28", caloriesTotal: null },
    ], [
      { day: "2026-11-25", totalCalories: 2200 },
      { day: "2026-11-26", totalCalories: 2500 },
    ]),
    [
      { day: "2026-11-25", totalCalories: 2200, source: "Manual log" },
      { day: "2026-11-26", totalCalories: 2412, source: "Garmin sync" },
      { day: "2026-11-27", totalCalories: 1810, source: "Garmin sync" },
    ],
  );
});
