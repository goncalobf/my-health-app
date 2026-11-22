import assert from "node:assert/strict";
import test from "node:test";
import { dateISOInTimeZone, startOfAppDay } from "./utils";
import { dateJiuJitsuLog, JIU_JITSU, jiuJitsuLog } from "./jiu-jitsu";

const base = { type: JIU_JITSU, day: "2026-10-25" };

test("jiu-jitsu accepts a date alone and rejects invalid effort, duration or invented calories", () => {
  assert.ok(jiuJitsuLog.safeParse(base).success);
  assert.ok(jiuJitsuLog.safeParse({ ...base, durationSeconds: 3600, effort: "hard" }).success);
  for (const fields of [
    { day: "2026-02-30" },
    { effort: "marathon" },
    { durationSeconds: "60" },
    { durationSeconds: 43201 },
    { calories: 500 },
  ]) {
    assert.equal(jiuJitsuLog.safeParse({ ...base, ...fields }).success, false);
  }
});

test("date-only class stays in the selected app day on a clock-change weekend", () => {
  const now = new Date(startOfAppDay(base.day).getTime() + 30 * 60_000);
  const { startedAt, finishedAt } = dateJiuJitsuLog(base.day, 3600, now);
  assert.equal(dateISOInTimeZone(startedAt), base.day);
  assert.equal(dateISOInTimeZone(finishedAt), base.day);
  assert.equal(finishedAt.getTime(), now.getTime());
});
