import assert from "node:assert/strict";
import test from "node:test";
import { appendMemoryNote } from "./coach-memory";

test("adds the first note to an empty memory", () => {
  assert.deepEqual(appendMemoryNote([], "Prefers direct language."), [
    "Prefers direct language.",
  ]);
});

test("appends under the cap without dropping anything", () => {
  const notes = ["Note one.", "Note two."];
  assert.deepEqual(appendMemoryNote(notes, "Note three."), [
    "Note one.",
    "Note two.",
    "Note three.",
  ]);
});

test("drops the oldest note once the 20-note cap is exceeded", () => {
  const notes = Array.from({ length: 20 }, (_, i) => `Note ${i}.`);
  const next = appendMemoryNote(notes, "Newest note.");
  assert.equal(next.length, 20);
  assert.equal(next[0], "Note 1.");
  assert.equal(next[next.length - 1], "Newest note.");
});

test("drops oldest notes once the total character cap is exceeded", () => {
  const notes = Array.from({ length: 10 }, () => "x".repeat(190));
  const next = appendMemoryNote(notes, "y".repeat(190));
  const total = next.reduce((sum, note) => sum + note.length, 0);
  assert.ok(total <= 2000);
  assert.equal(next[next.length - 1], "y".repeat(190));
});

test("truncates a single note longer than the per-note cap", () => {
  const next = appendMemoryNote([], "z".repeat(400));
  assert.equal(next.length, 1);
  assert.equal(next[0].length, 300);
  assert.ok(next[0].endsWith("…"));
});

test("ignores an empty or whitespace-only note", () => {
  const notes = ["Existing note."];
  assert.deepEqual(appendMemoryNote(notes, "   "), notes);
  assert.deepEqual(appendMemoryNote(notes, ""), notes);
});
