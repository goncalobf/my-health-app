import assert from "node:assert/strict";
import test from "node:test";
import { deriveUsernameBase, isValidUsername } from "./username";

test("derives first_last from a two-part name", () => {
  assert.equal(deriveUsernameBase("Jane Doe", "jane@example.com"), "jane_doe");
});

test("uses first and last of a longer name, ignoring middle names", () => {
  assert.equal(deriveUsernameBase("Jane Marie Doe", "jane@example.com"), "jane_doe");
});

test("strips accents and merges the letters back together", () => {
  assert.equal(deriveUsernameBase("Gonçalo Ferreira", "x@y.com"), "goncalo_ferreira");
});

test("falls back to a single lowercased word for a one-part name", () => {
  assert.equal(deriveUsernameBase("Gonçalo", "x@y.com"), "goncalo");
});

test("falls back to the email's local part when there's no name", () => {
  assert.equal(deriveUsernameBase(null, "jane.doe@example.com"), "jane_doe");
  assert.equal(deriveUsernameBase("", "jane.doe@example.com"), "jane_doe");
});

test("never leaves stray leading/trailing/doubled underscores", () => {
  assert.equal(deriveUsernameBase("  O'Brien  Smith-Jones ", "x@y.com"), "o_brien_smith_jones");
});

test("validates the allowed username charset and length", () => {
  assert.equal(isValidUsername("goncalo_barros"), true);
  assert.equal(isValidUsername("ab"), false); // too short
  assert.equal(isValidUsername("a".repeat(31)), false); // too long
  assert.equal(isValidUsername("Goncalo"), false); // uppercase not allowed
  assert.equal(isValidUsername("goncalo barros"), false); // space not allowed
  assert.equal(isValidUsername("goncalo.barros"), false); // dot not allowed
});
