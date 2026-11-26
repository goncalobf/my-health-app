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
  duration: number;
  distance: number;
  elevationGain: number;
  averageHR: number;
  maxHR: number;
  calories: number;
  averageSpeed: number;
  averagePower: number;
  averageCadence: number;
}

export interface GarminLegacyToken {
  oauth1: Record<string, unknown>;
  oauth2: Record<string, unknown>;
}

export interface GarminDiToken {
  kind: "di";
  accessToken: string;
  refreshToken: string;
  clientId: string;
}

export type GarminToken = GarminLegacyToken | GarminDiToken;

export function isStrengthActivity(typeKey: string): boolean {
  return STRENGTH_TYPE_KEYS.has(typeKey);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isGarminDiToken(value: unknown): value is GarminDiToken {
  return isRecord(value)
    && value.kind === "di"
    && typeof value.accessToken === "string"
    && value.accessToken.length > 20
    && typeof value.refreshToken === "string"
    && value.refreshToken.length > 20
    && typeof value.clientId === "string"
    && value.clientId.length > 2
    && value.clientId.length <= 200;
}

export function isGarminLegacyToken(value: unknown): value is GarminLegacyToken {
  return isRecord(value) && isRecord(value.oauth1) && isRecord(value.oauth2);
}

export function isGarminToken(value: unknown): value is GarminToken {
  return isGarminDiToken(value) || isGarminLegacyToken(value);
}

export function boundedText(value: unknown, maxLength: number, fallback = ""): string {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function finiteNumber(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : 0;
}

export function normalizeGarminActivity(value: unknown): GarminActivity | null {
  if (!isRecord(value)) return null;
  const rawType = isRecord(value.activityType) ? value.activityType : null;
  const activityId = finiteNumber(value.activityId, 1, Number.MAX_SAFE_INTEGER);
  if (!activityId) return null;

  return {
    activityId,
    activityName: boundedText(value.activityName, 200, "Garmin activity"),
    activityType: { typeKey: boundedText(rawType?.typeKey, 100, "other") },
    startTimeLocal: boundedText(value.startTimeLocal, 40),
    duration: finiteNumber(value.duration, 0, 60 * 60 * 24 * 7),
    distance: finiteNumber(value.distance, 0, 2_000_000),
    elevationGain: finiteNumber(value.elevationGain, 0, 100_000),
    averageHR: finiteNumber(value.averageHR, 0, 300),
    maxHR: finiteNumber(value.maxHR, 0, 300),
    calories: finiteNumber(value.calories, 0, 50_000),
    averageSpeed: finiteNumber(value.averageSpeed, 0, 200),
    averagePower: finiteNumber(value.averagePower, 0, 10_000),
    averageCadence: finiteNumber(value.averageCadence, 0, 500),
  };
}
