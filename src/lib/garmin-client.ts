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

export async function fetchRecentActivities(
  username: string,
  password: string,
  limit = 20
): Promise<GarminActivity[]> {
  const gc = new GarminConnect({ username, password });
  await gc.login(username, password);
  const activities = await gc.getActivities(0, limit);
  return (activities as GarminActivity[]).filter(
    (a) => !isStrengthActivity(a.activityType?.typeKey ?? "")
  );
}
