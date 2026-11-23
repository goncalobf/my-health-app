import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { basename } from "node:path";
import test from "node:test";
import { loggedMobilityRoutine, mobilityActivityType, mobilityIllustrationPath, mobilityMinutes, mobilityRoutines, mobilitySources, mobilitySteps, searchMobilityRoutines } from "./mobility";

test("each mobility routine has a stable activity identifier and sourced, playable steps", () => {
  assert.equal(new Set(mobilityRoutines.map((routine) => routine.id)).size, mobilityRoutines.length);
  for (const routine of mobilityRoutines) {
    assert.equal(loggedMobilityRoutine(mobilityActivityType(routine)), routine);
    assert.ok(mobilityMinutes(routine) > 0);
    const steps = mobilitySteps(routine);
    assert.ok(steps.length >= 3);
    for (const [index, step] of steps.entries()) {
      assert.ok(mobilitySources[step.source].url.startsWith("https://"));
      assert.ok(("seconds" in step.dose ? step.dose.seconds : step.dose.reps) > 0);
      if (step.side === "Left") {
        assert.equal(steps[index + 1]?.side, "Right");
        assert.equal(steps[index + 1]?.name, step.name);
      }
    }
  }
  assert.equal(loggedMobilityRoutine("run_easy"), undefined);
  assert.equal(loggedMobilityRoutine("mobility:unknown"), undefined);
});

test("every mobility exercise has a bundled illustration with two frame captions", () => {
  const illustrated = new Set(
    readdirSync(new URL("../../public/mobility-illustrations/", import.meta.url))
      .filter((file) => file.endsWith(".webp")),
  );
  const expected = new Set<string>();
  for (const step of mobilityRoutines.flatMap(mobilitySteps)) {
    expected.add(basename(mobilityIllustrationPath(step.id)));
    assert.equal(step.frames.length, 2, step.name);
    assert.ok(step.frames.every((caption) => caption.trim().length > 0), step.name);
  }
  assert.deepEqual(illustrated, expected);
});

test("region filtering and search handle plural names and exercise names", () => {
  assert.ok(searchMobilityRoutines("hips", "All").some((routine) => routine.id === "hip-mobility"));
  assert.ok(searchMobilityRoutines("shoulders", "Upper body").some((routine) => routine.id === "shoulder-mobility"));
  assert.ok(searchMobilityRoutines("figure-four", "All").some((routine) => routine.id === "post-jiu-jitsu"));
  assert.equal(searchMobilityRoutines("jiu-jitsu", "Sport prep").length, 2);
  assert.equal(searchMobilityRoutines("jiu-jitsu", "Upper body").length, 0);
});
