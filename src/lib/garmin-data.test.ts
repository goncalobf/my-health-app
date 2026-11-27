import assert from "node:assert/strict";
import test from "node:test";
import { garminActivityStart, normalizeGarminActivity } from "./garmin-data";
import { dateISOInTimeZone, parseActivityTime } from "./utils";

test("a Garmin activity keeps the provider's actual instant even when the local time differs", () => {
  const activity = normalizeGarminActivity({
    activityId: 9876,
    startTimeGMT: "2026-11-26 22:30:00",
    startTimeLocal: "2026-11-27 07:30:00",
  });
  assert.ok(activity);
  assert.equal(activity.startTimeGMT, "2026-11-26 22:30:00");
  const start = garminActivityStart(activity);
  assert.ok(start);
  assert.equal(start.toISOString(), "2026-11-26T22:30:00.000Z");
  assert.equal(dateISOInTimeZone(start, "Europe/Zurich"), "2026-11-26");
});

test("older Garmin records use explicit offsets or Fitlog's configured timezone", () => {
  assert.equal(garminActivityStart({ startTimeLocal: "2026-11-26T23:30:00+01:00" })?.toISOString(), "2026-11-26T22:30:00.000Z");
  const legacy = garminActivityStart({ startTimeLocal: "2026-11-26 23:30:00.125" });
  assert.ok(legacy);
  assert.equal(dateISOInTimeZone(legacy), "2026-11-26");
  assert.equal(legacy.getUTCMilliseconds(), 125);
  assert.equal(garminActivityStart({ startTimeLocal: "" }), null);
  assert.equal(parseActivityTime("2026-02-30 23:30:00", "utc"), null);
});
