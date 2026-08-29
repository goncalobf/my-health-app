import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDecimalInput, parseDecimalInput } from "./decimal-input";

test("keeps an unfinished decimal point so controlled inputs do not erase it", () => {
  assert.equal(normalizeDecimalInput("12."), "12.");
});

test("accepts the comma decimal separator used by localized iPhone keyboards", () => {
  assert.equal(normalizeDecimalInput("12,5"), "12.5");
  assert.equal(parseDecimalInput("12,5"), 12.5);
});

test("removes unsupported characters and additional decimal separators", () => {
  assert.equal(normalizeDecimalInput("1a2.3.4g"), "12.34");
});
