import type { GarminDailyMetrics } from "@/db/schema";
import { shiftISODate } from "./utils";

export type GarminSleepDay = Pick<GarminDailyMetrics, "date" | "sleepDurationSeconds" | "sleepScoreValue">;

export function formatSleepDuration(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function summarizeGarminSleep(day: string, rows: GarminSleepDay[]) {
  const fromDay = shiftISODate(day, -6);
  const nights = rows
    .filter((row) => row.date >= fromDay && row.date <= day)
    .map((row) => ({
      ...row,
      sleepDurationSeconds: row.sleepDurationSeconds !== null && row.sleepDurationSeconds > 0
        ? row.sleepDurationSeconds
        : null,
    }))
    .filter((row) => row.sleepDurationSeconds !== null || row.sleepScoreValue !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const earlierDurations = nights.flatMap((night) =>
    night.date < day && night.sleepDurationSeconds !== null ? [night.sleepDurationSeconds] : []);
  const earlierMeanSeconds = earlierDurations.length >= 3
    ? Math.round(earlierDurations.reduce((sum, seconds) => sum + seconds, 0) / earlierDurations.length)
    : null;

  return { nights, earlierMeanSeconds, earlierRecordedNights: earlierDurations.length };
}
