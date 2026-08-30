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

export interface GarminToken {
  oauth1: Record<string, unknown>;
  oauth2: Record<string, unknown>;
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

export function isStrengthActivity(typeKey: string): boolean {
  return STRENGTH_TYPE_KEYS.has(typeKey);
}

// Load a previously-exported token. No login request is made from the server —
// all subsequent calls use the stored OAuth tokens, which auto-refresh when expired.
function clientFromToken(token: GarminToken) {
  const gc = new GarminConnect({});
  gc.loadToken(token.oauth1, token.oauth2);
  return gc;
}

export async function fetchWithToken(
  token: GarminToken,
  limit = 20
): Promise<{ activities: GarminActivity[]; updatedToken: GarminToken }> {
  const gc = clientFromToken(token);
  const activities = await gc.getActivities(0, limit);
  const filtered = (activities as GarminActivity[]).filter(
    (a) => !isStrengthActivity(a.activityType?.typeKey ?? "")
  );
  return { activities: filtered, updatedToken: gc.exportToken() as GarminToken };
}

export async function fetchDailyMetricsWithToken(
  token: GarminToken,
  date: Date
): Promise<{ metrics: GarminDailyMetricsRaw; updatedToken: GarminToken }> {
  const gc = clientFromToken(token);
  const dateStr = date.toISOString().slice(0, 10);

  const metrics: GarminDailyMetricsRaw = {
    restingHrBpm: null,
    hrvScore: null,
    hrvBalanceScore: null,
    sleepDurationSeconds: null,
    sleepScoreValue: null,
    caloriesActive: null,
    caloriesTotal: null,
    steps: null,
  };

  try {
    const hr = await gc.getHeartRate(date) as Record<string, unknown>;
    if (typeof hr?.restingHeartRate === "number") {
      metrics.restingHrBpm = hr.restingHeartRate;
    }
  } catch { /* optional */ }

  try {
    const sleep = await gc.getSleepData(date) as Record<string, unknown>;
    const dto = sleep?.dailySleepDTO as Record<string, unknown> | undefined;
    if (typeof dto?.sleepTimeSeconds === "number") {
      metrics.sleepDurationSeconds = dto.sleepTimeSeconds;
    }
    const scores = dto?.sleepScores as Record<string, unknown> | undefined;
    const overall = scores?.overall as Record<string, unknown> | undefined;
    if (typeof overall?.value === "number") {
      metrics.sleepScoreValue = overall.value;
    }
  } catch { /* optional */ }

  try {
    const hrv = await gc.get(
      `https://connectapi.garmin.com/hrv-service/hrv/${dateStr}`
    ) as Record<string, unknown>;
    if (typeof hrv?.hrvSummary === "object" && hrv.hrvSummary) {
      const s = hrv.hrvSummary as Record<string, unknown>;
      if (typeof s.lastNight === "number") metrics.hrvScore = s.lastNight;
      if (typeof s.lastNightAvg === "number") metrics.hrvBalanceScore = s.lastNightAvg;
    }
  } catch { /* device may not support HRV */ }

  try {
    const cal = await gc.get(
      `https://connectapi.garmin.com/usersummary-service/usersummary/daily/${dateStr}`
    ) as Record<string, unknown>;
    if (typeof cal?.activeKilocalories === "number") metrics.caloriesActive = cal.activeKilocalories;
    if (typeof cal?.totalKilocalories === "number") metrics.caloriesTotal = cal.totalKilocalories;
    if (typeof cal?.totalSteps === "number") metrics.steps = cal.totalSteps;
  } catch { /* optional */ }

  return { metrics, updatedToken: gc.exportToken() as GarminToken };
}

// Validate a token by making a lightweight API call.
export async function validateToken(token: GarminToken): Promise<void> {
  const gc = clientFromToken(token);
  await gc.getActivities(0, 1);
}
