import "server-only";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GarminConnect } = require("garmin-connect");

// Garmin activity typeKey values that map to strength training.
// These are filtered out at sync time and never appear in the pending imports queue.
const STRENGTH_TYPE_KEYS = new Set([
  "strength_training",
  "fitness_equipment",
  "bouldering",
]);

export interface GarminActivity {
  activityId: number;
  activityName: string;
  activityType: { typeKey: string };
  startTimeLocal: string;
  duration: number; // seconds
  distance: number; // meters
  elevationGain: number; // meters
  averageHR: number;
  maxHR: number;
  calories: number;
  averageSpeed: number; // m/s
  averagePower: number; // watts
  averageCadence: number;
}

export function isStrengthActivity(typeKey: string): boolean {
  return STRENGTH_TYPE_KEYS.has(typeKey);
}

export interface GarminDailyMetricsRaw {
  restingHrBpm: number | null;
  hrvScore: number | null;
  hrvBalanceScore: number | null;
  sleepDurationSeconds: number | null;
  sleepScoreValue: number | null;
  caloriesActive: number | null;
  caloriesTotal: number | null;
  steps: number | null;
}

async function loginClient(username: string, password: string) {
  const gc = new GarminConnect({ username, password });
  await gc.login(username, password);
  return gc;
}

export async function fetchRecentActivities(
  username: string,
  password: string,
  limit = 20
): Promise<GarminActivity[]> {
  const gc = await loginClient(username, password);
  const activities = await gc.getActivities(0, limit);
  return (activities as GarminActivity[]).filter(
    (a) => !isStrengthActivity(a.activityType?.typeKey ?? "")
  );
}

export async function fetchDailyMetrics(
  username: string,
  password: string,
  date: Date
): Promise<GarminDailyMetricsRaw> {
  const gc = await loginClient(username, password);
  const dateStr = date.toISOString().slice(0, 10);

  const result: GarminDailyMetricsRaw = {
    restingHrBpm: null,
    hrvScore: null,
    hrvBalanceScore: null,
    sleepDurationSeconds: null,
    sleepScoreValue: null,
    caloriesActive: null,
    caloriesTotal: null,
    steps: null,
  };

  // Resting HR
  try {
    const hr = await gc.getHeartRate(date) as Record<string, unknown>;
    if (typeof hr?.restingHeartRate === "number") {
      result.restingHrBpm = hr.restingHeartRate;
    }
  } catch { /* optional */ }

  // Sleep
  try {
    const sleep = await gc.getSleepData(date) as Record<string, unknown>;
    const dto = sleep?.dailySleepDTO as Record<string, unknown> | undefined;
    if (typeof dto?.sleepTimeSeconds === "number") {
      result.sleepDurationSeconds = dto.sleepTimeSeconds;
    }
    const scores = dto?.sleepScores as Record<string, unknown> | undefined;
    const overall = scores?.overall as Record<string, unknown> | undefined;
    if (typeof overall?.value === "number") {
      result.sleepScoreValue = overall.value;
    }
  } catch { /* optional */ }

  // HRV — raw endpoint not wrapped by npm package
  try {
    const hrv = await gc.get(
      `https://connectapi.garmin.com/hrv-service/hrv/${dateStr}`
    ) as Record<string, unknown>;
    if (typeof hrv?.hrvSummary === "object" && hrv.hrvSummary) {
      const s = hrv.hrvSummary as Record<string, unknown>;
      if (typeof s.lastNight === "number") result.hrvScore = s.lastNight;
      if (typeof s.lastNightAvg === "number") result.hrvBalanceScore = s.lastNightAvg;
    }
  } catch { /* device may not support HRV */ }

  // Daily calories — raw endpoint
  try {
    const cal = await gc.get(
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${dateStr}`
    ) as Record<string, unknown>;
    if (typeof cal?.activeKilocalories === "number") result.caloriesActive = cal.activeKilocalories;
    if (typeof cal?.totalKilocalories === "number") result.caloriesTotal = cal.totalKilocalories;
    if (typeof cal?.totalSteps === "number") result.steps = cal.totalSteps;
  } catch { /* optional */ }

  return result;
}
