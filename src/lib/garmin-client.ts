import "server-only";
import {
  boundedText,
  isGarminDiToken,
  isGarminLegacyToken,
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
const { GarminConnect } = require("garmin-connect") as typeof import("garmin-connect");

const CONNECT_API = "https://connectapi.garmin.com";
const DI_TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const REQUEST_TIMEOUT_MS = 8_000;

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

export class GarminAuthenticationFailed extends Error {}
export class GarminRefreshPersistenceFailed extends Error {}

interface GarminClientOptions {
  signal: AbortSignal;
  onRefresh?: (token: GarminToken) => Promise<void>;
  fetch?: typeof fetch;
}

type LegacyClient = InstanceType<typeof GarminConnect>;

function requestSignal(signal: AbortSignal) {
  return AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]);
}

function legacyClientFromToken(
  token: GarminLegacyToken, getSignal: () => AbortSignal, fetcher: typeof fetch,
): LegacyClient {
  const gc = new GarminConnect({ username: "", password: "" });
  // The SDK's default 401 interceptor queues refreshes globally and can
  // retry another client's request with this client's bearer token.
  gc.client.client.interceptors.response.clear();
  gc.client.client.interceptors.request.use((config) => {
    config.signal = getSignal();
    config.timeout = REQUEST_TIMEOUT_MS;
    config.maxRedirects = 0;
    return config;
  });
  gc.client.fetchOauthConsumer = async () => {
    const response = await fetcher("https://thegarth.s3.amazonaws.com/oauth_consumer.json", {
      signal: getSignal(), redirect: "error", cache: "no-store",
    });
    if (!response.ok) throw new Error("Garmin OAuth consumer unavailable");
    const data: unknown = await response.json();
    if (!isRecord(data) || typeof data.consumer_key !== "string" || typeof data.consumer_secret !== "string") {
      throw new Error("Garmin OAuth consumer response invalid");
    }
    gc.client.OAUTH_CONSUMER = { key: data.consumer_key, secret: data.consumer_secret };
  };
  // The SDK's refresh uses OAuth1; only the access token is needed for data requests.
  gc.loadToken(token.oauth1, token.oauth2 as Parameters<LegacyClient["loadToken"]>[1]);
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

async function refreshDiToken(token: GarminDiToken, signal: AbortSignal, fetcher: typeof fetch): Promise<GarminDiToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: token.clientId,
    refresh_token: token.refreshToken,
  });
  const response = await fetcher(DI_TOKEN_URL, {
    method: "POST",
    headers: {
      ...NATIVE_HEADERS,
      Authorization: `Basic ${Buffer.from(`${token.clientId}:`).toString("base64")}`,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body,
    signal: requestSignal(signal),
    redirect: "error",
    cache: "no-store",
  });
  if ([400, 401, 403].includes(response.status)) throw new GarminAuthenticationFailed("Garmin rejected the refresh token");
  if (!response.ok) throw new Error("Garmin token refresh failed");
  const data = await response.json().catch(() => null) as unknown;
  const next = isRecord(data) && typeof data.access_token === "string" ? {
    kind: "di",
    accessToken: data.access_token,
    refreshToken: data.refresh_token === undefined ? token.refreshToken : data.refresh_token,
    clientId: tokenClientId(data.access_token) ?? token.clientId,
  } : null;
  if (!isGarminDiToken(next)) throw new Error("Garmin token refresh returned an invalid response");
  return next;
}

export function createGarminClient(original: GarminToken, options: GarminClientOptions) {
  let token = original;
  let signal = options.signal;
  let refreshed = false;
  const fetcher = options.fetch ?? fetch;
  const gc = isGarminDiToken(original) ? null : legacyClientFromToken(original, () => requestSignal(signal), fetcher);

  async function refresh() {
    if (isGarminDiToken(token)) {
      token = await refreshDiToken(token, signal, fetcher);
    } else if (gc) {
      try {
        await gc.client.refreshOauth2Token();
      } catch (error) {
        if ([400, 401, 403].includes(responseStatus(error))) throw new GarminAuthenticationFailed("Garmin rejected the legacy token");
        throw error;
      }
      const next = gc.exportToken();
      if (!isGarminLegacyToken(next)) throw new Error("Garmin did not renew the legacy token");
      token = next;
    }
    refreshed = true;
    // Garmin may rotate credentials. Commit them before any follow-up request.
    try {
      await options.onRefresh?.(token);
    } catch (error) {
      throw new GarminRefreshPersistenceFailed("Could not persist renewed Garmin credentials", { cause: error });
    }
  }

  async function request(path: string, params?: Record<string, string>) {
    signal.throwIfAborted();
    if (!refreshed && isGarminDiToken(token) && tokenExpiresSoon(token.accessToken)) await refresh();
    const url = new URL(path, CONNECT_API);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

    const send = async (): Promise<unknown> => {
      if (gc) return gc.client.get(url.toString());
      if (!isGarminDiToken(token)) throw new GarminAuthenticationFailed();
      const response = await fetcher(url, {
        headers: { ...NATIVE_HEADERS, Authorization: `Bearer ${token.accessToken}`, Accept: "application/json" },
        signal: requestSignal(signal), cache: "no-store", redirect: "error",
      });
      if ([401, 403].includes(response.status)) throw new GarminAuthenticationFailed();
      if (!response.ok) throw new Error(`Garmin API request failed (${response.status})`);
      return response.json();
    };
    try {
      return await send();
    } catch (error) {
      if (!isRejected(error)) throw error;
      if (refreshed) throw new GarminAuthenticationFailed();
    }
    await refresh();
    try {
      return await send();
    } catch (error) {
      if (isRejected(error)) throw new GarminAuthenticationFailed();
      throw error;
    }
  }

  return {
    get token() { return token; },
    async activities(limit = 20) {
      const size = Math.min(Math.max(Math.trunc(limit), 1), 100);
      const raw = await request("/activitylist-service/activities/search/activities", {
        start: "0", limit: String(size),
      });
      if (!Array.isArray(raw)) throw new Error("Invalid Garmin activities response");
      const normalized = raw.slice(0, size).map(normalizeGarminActivity);
      if (raw.length && normalized.every((value) => value === null)) throw new Error("Invalid Garmin activities");
      const cardio = new Map<number, GarminActivity>();
      for (const activity of normalized) {
        if (activity && !isStrengthActivity(activity.activityType.typeKey) && !cardio.has(activity.activityId)) {
          cardio.set(activity.activityId, activity);
        }
      }
      return [...cardio.values()];
    },
    async dailyMetrics(date: string, budget: AbortSignal) {
      signal = AbortSignal.any([options.signal, budget]);
      try {
        return await dailyMetrics(request, date);
      } finally {
        signal = options.signal;
      }
    },
  };
}

function responseStatus(error: unknown) {
  return isRecord(error) && isRecord(error.response) ? Number(error.response.status) : 0;
}

function isRejected(error: unknown) {
  return error instanceof GarminAuthenticationFailed || [401, 403].includes(responseStatus(error));
}

async function dailyMetrics(
  request: (path: string, params?: Record<string, string>) => Promise<unknown>, date: string,
): Promise<Partial<GarminDailyMetricsRaw>> {
  const metrics: Partial<GarminDailyMetricsRaw> = {};
  function record(key: keyof GarminDailyMetricsRaw, value: unknown, min: number, max: number) {
    const integer = boundedInteger(value, min, max);
    if (integer !== null) metrics[key] = integer;
  }
  async function optional(path: string, params?: Record<string, string>) {
    try {
      const data = await request(path, params);
      return isRecord(data) ? data : null;
    } catch (error) {
      if (error instanceof GarminAuthenticationFailed) throw error;
      // Persistence of a rotated token is mandatory even on optional endpoints.
      if (error instanceof GarminRefreshPersistenceFailed) throw error;
      return null;
    }
  }

  const profile = await optional("/userprofile-service/socialProfile");
  const name = boundedText(profile?.displayName, 200);
  if (name && name !== "." && name !== "..") {
    const encodedName = encodeURIComponent(name);
    const hr = await optional(`/wellness-service/wellness/dailyHeartRate/${encodedName}`, { date });
    record("restingHrBpm", hr?.restingHeartRate, 20, 300);
    const sleep = await optional(`/wellness-service/wellness/dailySleepData/${encodedName}`, { date, nonSleepBufferMinutes: "60" });
    const dto = isRecord(sleep?.dailySleepDTO) ? sleep.dailySleepDTO : null;
    const scores = isRecord(dto?.sleepScores) ? dto.sleepScores : null;
    const overall = isRecord(scores?.overall) ? scores.overall : null;
    record("sleepDurationSeconds", dto?.sleepTimeSeconds, 0, 36 * 3600);
    record("sleepScoreValue", overall?.value, 0, 100);
    const summary = await optional(`/usersummary-service/usersummary/daily/${encodedName}`, { calendarDate: date });
    record("caloriesActive", summary?.activeKilocalories, 0, 50_000);
    record("caloriesTotal", summary?.totalKilocalories, 0, 50_000);
    record("steps", summary?.totalSteps, 0, 500_000);
  }
  const hrv = await optional(`/hrv-service/hrv/${date}`);
  const summary = isRecord(hrv?.hrvSummary) ? hrv.hrvSummary : null;
  record("hrvScore", summary?.lastNight, 0, 1000);
  record("hrvBalanceScore", summary?.lastNightAvg, 0, 1000);
  return metrics;
}
