import assert from "node:assert/strict";
import test from "node:test";
import { loggedMobilityRoutine, mobilityActivityType, mobilityMinutes, mobilityRoutines, mobilitySources, mobilitySteps, searchMobilityRoutines } from "./mobility";

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

test("region filtering and search handle plural names and exercise names", () => {
  assert.ok(searchMobilityRoutines("hips", "All").some((routine) => routine.id === "hip-mobility"));
  assert.ok(searchMobilityRoutines("shoulders", "Upper body").some((routine) => routine.id === "shoulder-mobility"));
  assert.ok(searchMobilityRoutines("figure-four", "All").some((routine) => routine.id === "post-jiu-jitsu"));
  assert.equal(searchMobilityRoutines("jiu-jitsu", "Sport prep").length, 2);
  assert.equal(searchMobilityRoutines("jiu-jitsu", "Upper body").length, 0);
});
