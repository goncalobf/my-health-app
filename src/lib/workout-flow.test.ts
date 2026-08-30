import assert from "node:assert/strict";
import test from "node:test";
import {
  applySessionExerciseOrder,
  firstIncompletePosition,
  groupLoggedRows,
  nextIncompletePosition,
  nextSetNumber,
  reorderExerciseIds,
} from "./workout-flow";

const done = "2026-08-29T10:00:00.000Z";

test("keeps a drop under the set it belongs to, in the order it was taken", () => {
  const groups = groupLoggedRows([
    { id: 3, setNumber: 2, completedAt: done },
    { id: 1, setNumber: 1, completedAt: done },
    { id: 5, setNumber: 2, completedAt: done },
    { id: 4, setNumber: 2, completedAt: done },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.map((g) => g.setNumber),
    [1, 2]
  );
  assert.deepEqual(groups[1].rows.map((r) => r.id), [3, 4, 5]);
});

test("treats sets logged without drops as one row each", () => {
  const groups = groupLoggedRows([
    { id: 1, setNumber: 1, completedAt: done },
    { id: 2, setNumber: 2, completedAt: null },
  ]);
  assert.deepEqual(groups.map((g) => g.completed), [true, false]);
});

test("marks a set done from its working effort, not its drops", () => {
  const groups = groupLoggedRows([
    { id: 1, setNumber: 1, completedAt: null },
    { id: 2, setNumber: 1, completedAt: done },
  ]);
  assert.equal(groups[0].completed, false);
});

test("never reissues a set number after one is removed", () => {
  assert.equal(nextSetNumber([{ setNumber: 2 }, { setNumber: 3 }]), 4);
  assert.equal(nextSetNumber([]), 1);
});

test("advances to the next set, then into the next exercise", () => {
  const blocks = [
    { sets: [{ key: "a1", completed: true }, { key: "a2", completed: false }] },
    { sets: [{ key: "b1", completed: false }] },
  ];
  assert.deepEqual(nextIncompletePosition(blocks, 0, "a1"), {
    exIdx: 0,
    setKey: "a2",
  });
  assert.deepEqual(nextIncompletePosition(blocks, 0, "a2"), {
    exIdx: 1,
    setKey: "b1",
  });
});

test("wraps back to a set skipped earlier", () => {
  const blocks = [
    { sets: [{ key: "a1", completed: false }, { key: "a2", completed: true }] },
    { sets: [{ key: "b1", completed: true }] },
  ];
  assert.deepEqual(nextIncompletePosition(blocks, 1, "b1"), {
    exIdx: 0,
    setKey: "a1",
  });
});

test("reports nothing left rather than returning the set just logged", () => {
  const blocks = [
    { sets: [{ key: "a1", completed: true }, { key: "a2", completed: false }] },
  ];
  assert.equal(nextIncompletePosition(blocks, 0, "a2"), null);
});

test("starts on the first unlogged set of the workout", () => {
  const blocks = [
    { sets: [{ key: "a1", completed: true }] },
    { sets: [{ key: "b1", completed: false }] },
  ];
  assert.deepEqual(firstIncompletePosition(blocks), { exIdx: 1, setKey: "b1" });
  assert.equal(
    firstIncompletePosition([{ sets: [{ key: "a1", completed: true }] }]),
    null
  );
});

test("reorders a plan by a saved exercise order", () => {
  const plan = [{ exerciseId: 1 }, { exerciseId: 2 }, { exerciseId: 3 }];
  assert.deepEqual(
    applySessionExerciseOrder(plan, [3, 1, 2]).map((p) => p.exerciseId),
    [3, 1, 2]
  );
});

test("keeps original relative order for a plan with no saved order", () => {
  const plan = [{ exerciseId: 1 }, { exerciseId: 2 }];
  assert.deepEqual(applySessionExerciseOrder(plan, null), plan);
  assert.deepEqual(applySessionExerciseOrder(plan, []), plan);
});

test("sends exercises missing from a saved order to the end, in original order", () => {
  const plan = [{ exerciseId: 1 }, { exerciseId: 2 }, { exerciseId: 3 }];
  assert.deepEqual(
    applySessionExerciseOrder(plan, [2]).map((p) => p.exerciseId),
    [2, 1, 3]
  );
});

test("ignores a saved order id no longer in the plan", () => {
  const plan = [{ exerciseId: 1 }, { exerciseId: 2 }];
  assert.deepEqual(
    applySessionExerciseOrder(plan, [99, 2, 1]).map((p) => p.exerciseId),
    [2, 1]
  );
});

test("combines a drag of the unlocked tail with the locked exercises kept in place", () => {
  assert.deepEqual(
    reorderExerciseIds([1, 2, 3, 4], new Set([1, 3]), [4, 2]),
    [1, 3, 4, 2]
  );
});

test("reorders freely when nothing is locked yet", () => {
  assert.deepEqual(
    reorderExerciseIds([1, 2, 3], new Set(), [3, 1, 2]),
    [3, 1, 2]
  );
});
