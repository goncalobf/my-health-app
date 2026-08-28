import assert from "node:assert/strict";
import test from "node:test";
import { buildNutritionPhase } from "./nutrition-phase";

const base = {
  goal: "fat_loss",
  today: "2026-08-28",
  targetWeeklyChangePct: -0.5,
  weights: [],
};

test("a 28-day phase is reported as week four", () => {
  const phase = buildNutritionPhase({ ...base, startedOn: "2026-08-01" });
  assert.equal(phase.status, "active");
  assert.equal(phase.daysElapsed, 28);
  assert.equal(phase.weekNumber, 4);
  assert.match(phase.title, /Week 4/);
  assert.match(phase.guidance, /Four-week check-in/);
});

test("a missing start date produces a setup reminder", () => {
  const phase = buildNutritionPhase({ ...base, startedOn: null });
  assert.equal(phase.status, "setup_required");
  assert.match(phase.guidance, /Settings/);
});

test("a twelve-week cut triggers a maintenance-phase review, not a mandate", () => {
  const phase = buildNutritionPhase({ ...base, startedOn: "2026-06-06" });
  assert.equal(phase.weekNumber, 12);
  assert.match(phase.guidance, /Consider a 1-2 week maintenance phase/);
  assert.match(phase.guidance, /does not prove/);
});

test("weight trend is compared with the planned weekly rate", () => {
  const phase = buildNutritionPhase({
    ...base,
    startedOn: "2026-08-01",
    weights: [
      { day: "2026-08-07", weightKg: 80 },
      { day: "2026-08-14", weightKg: 79.6 },
      { day: "2026-08-21", weightKg: 79.2 },
      { day: "2026-08-28", weightKg: 78.8 },
    ],
  });
  assert.equal(phase.rateAssessment, "on_plan");
  assert.ok((phase.observedWeeklyChangePct ?? 0) < 0);
});
