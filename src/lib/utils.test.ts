import assert from "node:assert/strict";
import test from "node:test";
import {
  dateISOInTimeZone,
  dayOfWeekISO,
  shiftISODate,
  startOfAppDay,
} from "./utils";

test("shiftISODate moves exactly one calendar day across boundaries", () => {
  assert.equal(shiftISODate("2026-08-28", -1), "2026-08-27");
  assert.equal(shiftISODate("2026-08-28", 1), "2026-08-29");
  assert.equal(shiftISODate("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftISODate("2028-02-28", 1), "2028-02-29");
});

test("dayOfWeekISO uses the Monday-to-Sunday schedule numbering", () => {
  assert.equal(dayOfWeekISO("2026-08-24"), 1);
  assert.equal(dayOfWeekISO("2026-08-30"), 7);
});

test("Europe/Zurich dates stay correct around UTC midnight", () => {
  assert.equal(
    dateISOInTimeZone(new Date("2026-08-27T22:30:00.000Z")),
    "2026-08-28"
  );
  assert.equal(
    dateISOInTimeZone(new Date("2026-01-27T23:30:00.000Z")),
    "2026-01-28"
  );
});

test("startOfAppDay accounts for summer and winter offsets", () => {
  assert.equal(
    startOfAppDay("2026-08-28").toISOString(),
    "2026-08-27T22:00:00.000Z"
  );
  assert.equal(
    startOfAppDay("2026-01-28").toISOString(),
    "2026-01-27T23:00:00.000Z"
  );
});
