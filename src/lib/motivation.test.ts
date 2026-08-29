import assert from "node:assert/strict";
import test from "node:test";
import { MOTIVATION_IMAGES, pickImage, pickLine, seedIndex } from "./motivation";
import {
  buildMotivationFacts,
  isSlipping,
  topMotivationFact,
  type MotivationInput,
} from "./motivation-facts";

const base: MotivationInput = {
  daysSinceLastWorkout: 1,
  workoutsThisWeek: 2,
  workoutsPreviousWeek: 2,
  volumeThisWeekKg: 10000,
  volumePreviousWeekKg: 10000,
  bestLift: null,
  totalWorkouts: 7,
};

test("the same seed always gives the same line and image", () => {
  assert.equal(pickLine("hype", "session-42"), pickLine("hype", "session-42"));
  assert.equal(pickImage("2026-08-29"), pickImage("2026-08-29"));
});

test("different contexts can differ on one seed", () => {
  const seeds = ["a", "b", "c", "d", "e"];
  const differs = seeds.some(
    (s) => pickLine("hype", s) !== pickLine("slipping", s)
  );
  assert.ok(differs, "hype and slipping should not be locked together");
});

test("selection stays inside the available content", () => {
  for (const seed of ["", "x", "2026-01-01", "session-999999"]) {
    assert.ok(MOTIVATION_IMAGES.includes(pickImage(seed)));
    assert.equal(typeof pickLine("workout", seed), "string");
    assert.ok(pickLine("workout", seed).length > 0);
  }
  assert.equal(seedIndex("anything", 0), 0);
});

test("three days without training counts as slipping", () => {
  assert.equal(isSlipping({ ...base, daysSinceLastWorkout: 2 }), false);
  assert.equal(isSlipping({ ...base, daysSinceLastWorkout: 3 }), true);
  assert.equal(isSlipping({ ...base, daysSinceLastWorkout: null }), false);
});

test("an absence outranks a good week", () => {
  const fact = topMotivationFact({
    ...base,
    daysSinceLastWorkout: 5,
    workoutsThisWeek: 4,
  });
  assert.equal(fact?.kind, "absence");
  assert.match(fact!.text, /5 days/);
});

test("reports volume in both directions but ignores noise", () => {
  const up = buildMotivationFacts({
    ...base,
    volumeThisWeekKg: 12000,
    volumePreviousWeekKg: 10000,
  });
  assert.match(up.find((f) => f.kind === "volume")!.text, /20% more volume/);

  const down = buildMotivationFacts({
    ...base,
    volumeThisWeekKg: 8000,
    volumePreviousWeekKg: 10000,
  });
  assert.match(down.find((f) => f.kind === "volume")!.text, /down 20%/);

  const flat = buildMotivationFacts({
    ...base,
    volumeThisWeekKg: 10200,
    volumePreviousWeekKg: 10000,
  });
  assert.equal(flat.find((f) => f.kind === "volume"), undefined);
});

test("says nothing when there is no history to draw on", () => {
  const facts = buildMotivationFacts({
    daysSinceLastWorkout: null,
    workoutsThisWeek: 0,
    workoutsPreviousWeek: 0,
    volumeThisWeekKg: 0,
    volumePreviousWeekKg: 0,
    bestLift: null,
    totalWorkouts: 0,
  });
  assert.deepEqual(facts, []);
});

test("names the lift that moved", () => {
  const fact = buildMotivationFacts({
    ...base,
    bestLift: { name: "Bench Press", gainKg: 7.5 },
  }).find((f) => f.kind === "lift");
  assert.equal(fact?.text, "Bench Press is up 7.5kg.");
});

test("only calls out round-number workout milestones", () => {
  assert.ok(
    buildMotivationFacts({ ...base, totalWorkouts: 20 }).some(
      (f) => f.kind === "milestone"
    )
  );
  assert.ok(
    !buildMotivationFacts({ ...base, totalWorkouts: 21 }).some(
      (f) => f.kind === "milestone"
    )
  );
});
