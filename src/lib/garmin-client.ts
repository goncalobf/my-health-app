import "server-only";
import {
  boundedText,
  isGarminDiToken,
  isRecord,
  isStrengthActivity,
  normalizeGarminActivity,
  type GarminActivity,
  type GarminDiToken,
  type GarminLegacyToken,
  type GarminToken,
} from "@/lib/garmin-data";
export {
  isGarminDiToken,
  isGarminLegacyToken,
  isGarminToken,
  isStrengthActivity,
  normalizeGarminActivity,
} from "@/lib/garmin-data";
export type {
  GarminActivity,
  GarminDiToken,
  GarminLegacyToken,
  GarminToken,
} from "@/lib/garmin-data";
// Kept for users who connected before the DI-token migration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GarminConnect } = require("garmin-connect");

const CONNECT_API = "https://connectapi.garmin.com";
const DI_TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const REQUEST_TIMEOUT_MS = 15_000;

const NATIVE_HEADERS = {
  "User-Agent": "GCM-Android-5.23",
  "X-Garmin-User-Agent":
    "com.garmin.android.apps.connectmobile/5.23; ; Google/sdk_gphone64_arm64/google; Android/33; Dalvik/2.1.0",
  "X-Garmin-Paired-App-Version": "10861",
  "X-Garmin-Client-Platform": "Android",
  "X-App-Ver": "10861",
  "X-Lang": "en",
  "X-GCExperience": "GC5",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

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

function boundedInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return null;
  }
  return Math.round(value);
}

function emptyMetrics(): GarminDailyMetricsRaw {
  return {
    restingHrBpm: null,
    hrvScore: null,
    hrvBalanceScore: null,
    sleepDurationSeconds: null,
    sleepScoreValue: null,
    caloriesActive: null,
    caloriesTotal: null,
    steps: null,
  };
}

function legacyClientFromToken(token: GarminLegacyToken) {
  const gc = new GarminConnect({});
  gc.loadToken(token.oauth1, token.oauth2);
  return gc;
}

function tokenExpiresSoon(accessToken: string): boolean {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as unknown;
    if (!isRecord(payload) || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return false;
    }
    return Date.now() >= (payload.exp - 5 * 60) * 1000;
  } catch {
    return false;
  }
}

function tokenClientId(accessToken: string): string | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as unknown;
    if (!isRecord(payload) || typeof payload.client_id !== "string") return null;
    const clientId = payload.client_id.trim();
    return clientId.length >= 3 && clientId.length <= 200 ? clientId : null;
  } catch {
    return null;
  }
}

async function refreshDiToken(token: GarminDiToken): Promise<GarminDiToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: token.clientId,
    refresh_token: token.refreshToken,
  });
  const response = await fetch(DI_TOKEN_URL, {
    method: "POST",
    headers: {
      ...NATIVE_HEADERS,
      Authorization: `Basic ${Buffer.from(`${token.clientId}:`).toString("base64")}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Garmin token refresh failed");
  const data = await response.json().catch(() => null) as unknown;
  if (!isRecord(data) || typeof data.access_token !== "string") {
    throw new Error("Garmin token refresh returned an invalid response");
  }
  return {
    kind: "di",
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : token.refreshToken,
    clientId: tokenClientId(data.access_token) ?? token.clientId,
  };
}

async function diRequest(
  originalToken: GarminDiToken,
  path: string,
  params?: Record<string, string>,
): Promise<{ data: unknown; token: GarminDiToken }> {
  let token = tokenExpiresSoon(originalToken.accessToken)
    ? await refreshDiToken(originalToken)
    : originalToken;

  const request = async () => {
    const url = new URL(path, CONNECT_API);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    return fetch(url, {
      headers: {
        ...NATIVE_HEADERS,
        Authorization: `Bearer ${token.accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  };

  let response = await request();
  if (response.status === 401) {
    token = await refreshDiToken(token);
    response = await request();
  }
  if (!response.ok) throw new Error(`Garmin API request failed (${response.status})`);
  return { data: await response.json(), token };
}

export async function fetchWithToken(
  token: GarminToken,
  limit = 20,
): Promise<{ activities: GarminActivity[]; updatedToken: GarminToken }> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  if (isGarminDiToken(token)) {
    const result = await diRequest(token, "/activitylist-service/activities/search/activities", {
      start: "0",
      limit: String(safeLimit),
    });
    const activities = Array.isArray(result.data)
      ? result.data
          .map(normalizeGarminActivity)
          .filter((activity): activity is GarminActivity => activity !== null)
          .filter((activity) => !isStrengthActivity(activity.activityType.typeKey))
      : [];
    return { activities, updatedToken: result.token };
  }

  const gc = legacyClientFromToken(token);
  const raw = await gc.getActivities(0, safeLimit) as unknown;
  const activities = Array.isArray(raw)
    ? raw
        .map(normalizeGarminActivity)
        .filter((activity): activity is GarminActivity => activity !== null)
        .filter((activity) => !isStrengthActivity(activity.activityType.typeKey))
    : [];
  return { activities, updatedToken: gc.exportToken() as GarminLegacyToken };
}

async function fetchDiDailyMetrics(
  token: GarminDiToken,
  dateStr: string,
): Promise<{ metrics: GarminDailyMetricsRaw; updatedToken: GarminDiToken }> {
  const metrics = emptyMetrics();
  let currentToken = token;
  const profileResult = await diRequest(currentToken, "/userprofile-service/socialProfile");
  currentToken = profileResult.token;
  const profile = isRecord(profileResult.data) ? profileResult.data : null;
  const displayName = boundedText(profile?.displayName, 200);
  if (!displayName) throw new Error("Garmin profile has no display name");
  const encodedName = encodeURIComponent(displayName);

  try {
    const result = await diRequest(
      currentToken,
      `/wellness-service/wellness/dailyHeartRate/${encodedName}`,
      { date: dateStr },
    );
    currentToken = result.token;
    const data = isRecord(result.data) ? result.data : null;
    metrics.restingHrBpm = boundedInteger(data?.restingHeartRate, 20, 300);
  } catch { /* optional metric */ }

  try {
    const result = await diRequest(
      currentToken,
      `/wellness-service/wellness/dailySleepData/${encodedName}`,
      { date: dateStr, nonSleepBufferMinutes: "60" },
    );
    currentToken = result.token;
    const data = isRecord(result.data) ? result.data : null;
    const dto = isRecord(data?.dailySleepDTO) ? data.dailySleepDTO : null;
    const scores = isRecord(dto?.sleepScores) ? dto.sleepScores : null;
    const overall = isRecord(scores?.overall) ? scores.overall : null;
    metrics.sleepDurationSeconds = boundedInteger(dto?.sleepTimeSeconds, 0, 60 * 60 * 36);
    metrics.sleepScoreValue = boundedInteger(overall?.value, 0, 100);
  } catch { /* optional metric */ }

  try {
    const result = await diRequest(currentToken, `/hrv-service/hrv/${dateStr}`);
    currentToken = result.token;
    const data = isRecord(result.data) ? result.data : null;
    const summary = isRecord(data?.hrvSummary) ? data.hrvSummary : null;
    metrics.hrvScore = boundedInteger(summary?.lastNight, 0, 1_000);
    metrics.hrvBalanceScore = boundedInteger(summary?.lastNightAvg, 0, 1_000);
  } catch { /* device may not support HRV */ }

  try {
    const result = await diRequest(
      currentToken,
      `/usersummary-service/usersummary/daily/${encodedName}`,
      { calendarDate: dateStr },
    );
    currentToken = result.token;
    const data = isRecord(result.data) ? result.data : null;
    metrics.caloriesActive = boundedInteger(data?.activeKilocalories, 0, 50_000);
    metrics.caloriesTotal = boundedInteger(data?.totalKilocalories, 0, 50_000);
    metrics.steps = boundedInteger(data?.totalSteps, 0, 500_000);
  } catch { /* optional metric */ }

  return { metrics, updatedToken: currentToken };
}

export async function fetchDailyMetricsWithToken(
  token: GarminToken,
  date: Date,
): Promise<{ metrics: GarminDailyMetricsRaw; updatedToken: GarminToken }> {
  const dateStr = date.toISOString().slice(0, 10);
  if (isGarminDiToken(token)) return fetchDiDailyMetrics(token, dateStr);

  const gc = legacyClientFromToken(token);
  const metrics = emptyMetrics();

  try {
    const hr = await gc.getHeartRate(date) as Record<string, unknown>;
    metrics.restingHrBpm = boundedInteger(hr?.restingHeartRate, 20, 300);
  } catch { /* optional */ }

  try {
    const sleep = await gc.getSleepData(date) as Record<string, unknown>;
    const dto = isRecord(sleep?.dailySleepDTO) ? sleep.dailySleepDTO : null;
    const scores = isRecord(dto?.sleepScores) ? dto.sleepScores : null;
    const overall = isRecord(scores?.overall) ? scores.overall : null;
    metrics.sleepDurationSeconds = boundedInteger(dto?.sleepTimeSeconds, 0, 60 * 60 * 36);
    metrics.sleepScoreValue = boundedInteger(overall?.value, 0, 100);
  } catch { /* optional */ }

  try {
    const hrv = await gc.get(`${CONNECT_API}/hrv-service/hrv/${dateStr}`) as unknown;
    const data = isRecord(hrv) ? hrv : null;
    const summary = isRecord(data?.hrvSummary) ? data.hrvSummary : null;
    metrics.hrvScore = boundedInteger(summary?.lastNight, 0, 1_000);
    metrics.hrvBalanceScore = boundedInteger(summary?.lastNightAvg, 0, 1_000);
  } catch { /* device may not support HRV */ }

  try {
    const cal = await gc.get(
      `${CONNECT_API}/usersummary-service/usersummary/daily/${dateStr}`,
    ) as Record<string, unknown>;
    metrics.caloriesActive = boundedInteger(cal?.activeKilocalories, 0, 50_000);
    metrics.caloriesTotal = boundedInteger(cal?.totalKilocalories, 0, 50_000);
    metrics.steps = boundedInteger(cal?.totalSteps, 0, 500_000);
  } catch { /* optional */ }

  return { metrics, updatedToken: gc.exportToken() as GarminLegacyToken };
}

export async function validateToken(token: GarminToken): Promise<void> {
  if (isGarminDiToken(token)) {
    await diRequest(token, "/userprofile-service/socialProfile");
    return;
  }
  const gc = legacyClientFromToken(token);
  await gc.getActivities(0, 1);
}
