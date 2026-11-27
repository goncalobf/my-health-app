export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// Epley estimated one-rep max.
export function est1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export const APP_TIME_ZONE =
  process.env.NEXT_PUBLIC_APP_TIME_ZONE || "Europe/Zurich";

function zonedParts(date: Date, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

export function dateISOInTimeZone(
  date = new Date(),
  timeZone = APP_TIME_ZONE
): string {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayISO(): string {
  return dateISOInTimeZone();
}

export function shiftISODate(day: string, delta: number): string {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) return day;
  return new Date(Date.UTC(year, month - 1, date + delta, 12))
    .toISOString()
    .slice(0, 10);
}

export function dayOfWeekISO(day: string): number {
  const [year, month, date] = day.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function hourInAppTimeZone(date = new Date()): number {
  return zonedParts(date).hour;
}

export function startOfAppDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(appWallTimeToInstant(Date.UTC(year, month - 1, date)));
}

function appWallTimeToInstant(target: number): number {
  let instant = target;

  // Resolve the timezone offset at this date. Repeating handles DST boundaries.
  for (let i = 0; i < 2; i++) {
    const parts = zonedParts(new Date(instant));
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    ) + new Date(instant).getUTCMilliseconds();
    instant += target - represented;
  }
  return instant;
}

export function parseActivityTime(value: string, zone: "utc" | "app"): Date | null {
  const parts = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?$/.exec(value);
  if (!parts) return null;
  const wall = `${parts[1]}T${parts[2]}`;
  const time = wall + (parts[3] ?? "");
  const utc = new Date(time + "Z");
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 19) !== wall) return null;
  if (parts[4]) {
    const date = new Date(time + parts[4]);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (zone === "utc") return utc;

  const date = new Date(appWallTimeToInstant(utc.getTime()));
  const actual = zonedParts(date);
  const wallTime = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  return wallTime + date.getUTCMilliseconds() === utc.getTime() ? date : null;
}

export function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
