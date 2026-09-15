import assert from "node:assert/strict";
import test from "node:test";
import {
  comparablePrescription,
  effectivePlan,
  type Prescription,
} from "./training-prescription";
import { defaultPrescription } from "./training-validation";
import { muscleVolume, nextRoutineInSequence } from "./training-volume";
const p: Prescription = {
  ...defaultPrescription,
  slotId: 1,
  exerciseId: 1,
  name: "Synthetic",
  muscleGroup: "Chest",
  imageUrl: null,
};
const snapshot = { version: 1 as const, isDeload: false, plan: [p] };
test("history is separated by A/B prescription, machine setup and phase", () => {
  assert.equal(comparablePrescription(p, snapshot, "normal"), true);
  for (const patch of [
    { slotId: 2 },
    { targetSets: 2 },
    { minReps: 10 },
    { targetRirMin: 1 },
    {
      equipmentProfile: {
        machine: "Gym80",
        setup: "Seat 2",
        loading: "total" as const,
        availableLoads: [],
      },
    },
  ])
    assert.equal(
      comparablePrescription({ ...p, ...patch }, snapshot, "normal"),
      false,
    );
  assert.equal(
    comparablePrescription(p, { ...snapshot, isDeload: true }, "normal"),
    false,
  );
  assert.equal(comparablePrescription(p, snapshot, "interrupted"), false);
  assert.equal(comparablePrescription(p, null, "normal"), false);
});
test("deload presentation leaves saved prescription immutable", () => {
  const result = effectivePlan({ ...snapshot, isDeload: true });
  assert.equal(result[0].targetSets, 2);
  assert.equal(result[0].targetRirMin, 4);
  assert.equal(snapshot.plan[0].targetSets, 3);
});
test("muscle volume separates planned, performed, direct and indirect", () => {
  const row = {
    sets: 4,
    muscleGroup: "Chest",
    muscleProfile: { direct: ["Chest"], indirect: ["Triceps"] },
  };
  const result = muscleVolume([row], [{ ...row, sets: 2 }]);
  assert.equal(result.find((r) => r.muscle === "Chest")?.completedDirect, 2);
  assert.equal(result.find((r) => r.muscle === "Triceps")?.plannedEstimate, 2);
  assert.equal(
    result.find((r) => r.muscle === "Triceps")?.completedEstimate,
    1,
  );
});
test("rolling sequence survives missed days and wraps", () => {
  const routines = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.equal(nextRoutineInSequence(routines, 1)?.id, 2);
  assert.equal(nextRoutineInSequence(routines, 3)?.id, 1);
  assert.equal(nextRoutineInSequence(routines, 99)?.id, 1);
  assert.equal(nextRoutineInSequence([], null), null);
});
