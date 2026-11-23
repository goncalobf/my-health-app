import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import catalog from "./exercise-demo-catalog.json";
import { exerciseDemo } from "./exercise-demo";

const root = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/b0eed061e1c832b3ed815fbaa4b45b3cdc14df49/exercises";

test("imported exercises resolve to two pinned photos from their source entry", () => {
  for (const [id, name] of Object.entries(catalog)) {
    const encoded = encodeURIComponent(id);
    const demo = exerciseDemo(name, `${root}/${encoded}/0.jpg`);
    assert.equal(demo?.frames.length, 2, name);
  }
  assert.deepEqual(exerciseDemo("Bench Press", null)?.frames, [
    `${root}/Barbell_Bench_Press_-_Medium_Grip/0.jpg`,
    `${root}/Barbell_Bench_Press_-_Medium_Grip/1.jpg`,
  ]);
  assert.deepEqual(exerciseDemo("A saved nickname", `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Face_Pull/0.jpg`)?.frames, [
    `${root}/Face_Pull/0.jpg`, `${root}/Face_Pull/1.jpg`,
  ]);
});

test("strength variants resolve to equipment-specific guides and retain their frame files", () => {
  for (const [name, id] of [
    ["Machine Lateral Raise (Local Gym)", "machine-lateral-raise"],
    ["Incline Machine Press", "plate-loaded-incline-chest-press"],
    ["Gym80 Butterfly Dual", "pec-deck"],
    ["Single-Arm Overhead Cable Extension", "single-arm-overhead-cable-extension"],
    ["Leg Press (High Foot Placement)", "high-foot-leg-press"],
  ]) {
    const demo = exerciseDemo(name, `${root}/Side_Lateral_Raise/0.jpg`);
    assert.deepEqual(demo?.frames, [`/exercise-demos/${id}-0.webp`, `/exercise-demos/${id}-1.webp`], name);
    for (const frame of demo!.frames) {
      assert.ok(existsSync(new URL(`../../public${frame}`, import.meta.url)), frame);
    }
  }
  assert.match(exerciseDemo("Dumbbell Walking Lunge (Per Hand)", null)?.frames[0] ?? "", /Dumbbell_Lunges/);
  assert.equal(exerciseDemo("Bench Press (Unknown Variant)", null), null);
  assert.equal(exerciseDemo("Unmatched custom exercise", `${root}/%ff/0.jpg`), null);
});
