import assert from "node:assert/strict";
import test from "node:test";
import { createRequire, registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import {
  isGarminToken,
  normalizeGarminActivity,
  type GarminDiToken,
} from "./garmin-data";

async function loadGarminClient() {
  // Next supplies this marker via a bundler alias. Load its server implementation
  // in the standalone tests while keeping the bundling guard on the real module.
  const serverMarker = pathToFileURL(require.resolve("next/dist/compiled/server-only/empty.js")).href;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return specifier === "server-only" ? { url: serverMarker, shortCircuit: true } : next(specifier, context);
    },
  });
  try {
    return await import("./garmin-client");
  } finally {
    hooks.deregister();
  }
}

const token: GarminDiToken = {
  kind: "di",
  accessToken: "test-access-token-with-enough-characters",
  refreshToken: "test-refresh-token-with-enough-characters",
  clientId: "test-client",
};

test("recognizes current DI and legacy Garmin token shapes", () => {
  assert.equal(isGarminToken(token), true);
  assert.equal(isGarminToken({
    oauth1: { oauth_token: "legacy-token", oauth_token_secret: "legacy-secret" },
    oauth2: { access_token: "legacy-access" },
  }), true);
  assert.equal(isGarminToken({ oauth1: {}, oauth2: {} }), false);
  assert.equal(isGarminToken({ kind: "di", accessToken: "short" }), false);
  assert.equal(isGarminToken(null), false);
});

test("normalizes bounded Garmin activity values", () => {
  assert.deepEqual(normalizeGarminActivity({
    activityId: 42,
    activityName: "Morning run",
    activityType: { typeKey: "running" },
    duration: 1800,
    distance: 5000,
    averageHR: 999,
    calories: Number.NaN,
  }), {
    activityId: 42,
    activityName: "Morning run",
    activityType: { typeKey: "running" },
    startTimeLocal: "",
    duration: 1800,
    distance: 5000,
    elevationGain: 0,
    averageHR: 0,
    maxHR: 0,
    calories: 0,
    averageSpeed: 0,
    averagePower: 0,
    averageCadence: 0,
  });
  assert.equal(normalizeGarminActivity({ activityId: -1 }), null);
});

test("commits the rotated DI token before an activities retry can fail", async () => {
  const { createGarminClient } = await loadGarminClient();
  const rotatedAccess = "rotated-access-token-with-enough-characters";
  const rotatedRefresh = "rotated-refresh-token-with-enough-characters";
  const seen: string[] = [];
  const garmin = createGarminClient(token, {
    signal: new AbortController().signal,
    fetch: async (input, init) => {
      const url = new URL(input.toString());
      const headers = new Headers(init?.headers);
      if (url.hostname === "diauth.garmin.com") {
        assert.equal(init?.method, "POST");
        assert.equal(init?.redirect, "error");
        assert.equal(headers.get("Authorization"), `Basic ${Buffer.from("test-client:").toString("base64")}`);
        assert.equal(headers.get("Content-Type"), "application/x-www-form-urlencoded");
        assert.equal((init?.body as URLSearchParams).get("refresh_token"), token.refreshToken);
        seen.push("refresh");
        return Response.json({ access_token: rotatedAccess, refresh_token: rotatedRefresh });
      }
      assert.equal(url.pathname, "/activitylist-service/activities/search/activities");
      const bearer = headers.get("Authorization");
      if (bearer === `Bearer ${token.accessToken}`) {
        seen.push("initial");
        return new Response(null, { status: 401 });
      }
      assert.equal(bearer, `Bearer ${rotatedAccess}`);
      seen.push("retry");
      return new Response(null, { status: 503 });
    },
    onRefresh: async (value) => {
      assert.deepEqual(value, { ...token, accessToken: rotatedAccess, refreshToken: rotatedRefresh });
      seen.push("persist");
    },
  });
  await assert.rejects(garmin.activities(), /503/);
  assert.deepEqual(seen, ["initial", "refresh", "persist", "retry"]);
});

test("keeps available metrics when another endpoint fails and never writes missing values", async () => {
  const { createGarminClient } = await loadGarminClient();
  const garmin = createGarminClient(token, {
    signal: new AbortController().signal,
    fetch: async (input) => {
      const url = new URL(input.toString());
      switch (url.pathname) {
        case "/userprofile-service/socialProfile":
          return Response.json({ displayName: "test/profile" });
        case "/wellness-service/wellness/dailyHeartRate/test%2Fprofile":
          assert.equal(url.searchParams.get("date"), "2026-11-27");
          return Response.json({ restingHeartRate: 51 });
        case "/wellness-service/wellness/dailySleepData/test%2Fprofile":
          return new Response(null, { status: 503 });
        case "/usersummary-service/usersummary/daily/test%2Fprofile":
          assert.equal(url.searchParams.get("calendarDate"), "2026-11-27");
          return Response.json({ totalSteps: 0, activeKilocalories: null });
        case "/hrv-service/hrv/2026-11-27":
          return Response.json({ hrvSummary: { lastNightAvg: 63, lastNight: 61 } });
        default:
          assert.fail(`Unexpected Garmin endpoint ${url.pathname}`);
      }
    },
  });
  assert.deepEqual(await garmin.dailyMetrics("2026-11-27", new AbortController().signal), {
    metrics: { restingHrBpm: 51, steps: 0, hrvBalanceScore: 63, hrvScore: 61 },
    incomplete: true,
  });
});

test("Garmin days with no recorded readings still complete the health pull", async () => {
  const { createGarminClient } = await loadGarminClient();
  const client = createGarminClient(token, {
    signal: new AbortController().signal,
    fetch: async (input) => {
      const { pathname } = new URL(input.toString());
      if (pathname.endsWith("/socialProfile")) return Response.json({ displayName: "fixture" });
      if (pathname.includes("/dailySleepData/")) return new Response(null, { status: 204 });
      if (pathname.includes("/usersummary/")) return Response.json({ totalKilocalories: null });
      return new Response(null, { status: 404 });
    },
  });
  assert.deepEqual(await client.dailyMetrics("2026-11-27", new AbortController().signal), {
    metrics: {}, incomplete: false,
  });
});

test("refreshes legacy connections independently for simultaneous authorization failures", async () => {
  const { createGarminClient } = await loadGarminClient();
  const sdkRequire = createRequire(require.resolve("garmin-connect"));
  const axios: typeof import("axios").default = sdkRequire("axios");
  const adapter = axios.defaults.adapter;
  const events: string[] = [];
  axios.defaults.adapter = async (config) => {
    const url = new URL(config.url!);
    assert.equal(config.maxRedirects, 0);
    assert.ok(config.signal);
    let data;
    if (url.pathname.endsWith("/exchange/user/2.0")) {
      const account = url.searchParams.get("oauth_token");
      assert.ok(account === "alpha" || account === "beta");
      assert.ok(url.searchParams.get("oauth_signature"));
      events.push(`refresh:${account}`);
      data = { access_token: `new-${account}`, expires_in: 3600, refresh_token_expires_in: 7200 };
    } else {
      const bearer = String(config.headers.Authorization);
      if (bearer.startsWith("Bearer old-")) throw Object.assign(new Error("Rejected"), { response: { status: 401 } });
      assert.ok(bearer === "Bearer new-alpha" || bearer === "Bearer new-beta");
      events.push(`activities:${bearer}`);
      data = [{ activityId: bearer.endsWith("alpha") ? 1 : 2 }];
    }
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
  try {
    const accounts = ["alpha", "beta"].map((account) => createGarminClient({
      oauth1: { oauth_token: account, oauth_token_secret: `secret-${account}` },
      oauth2: { access_token: `old-${account}` },
    }, {
      signal: new AbortController().signal,
      fetch: async (input) => {
        assert.equal(input.toString(), "https://thegarth.s3.amazonaws.com/oauth_consumer.json");
        return Response.json({ consumer_key: "test-key", consumer_secret: "test-secret" });
      },
      onRefresh: async (next) => {
        assert.ok("oauth2" in next);
        assert.equal(next.oauth2.access_token, `new-${account}`);
        events.push(`persist:${account}`);
      },
    }));
    const result = await Promise.all(accounts.map((client) => client.activities()));
    assert.deepEqual(result.map(([activity]) => activity.activityId), [1, 2]);
    for (const account of ["alpha", "beta"]) {
      assert.ok(events.indexOf(`refresh:${account}`) < events.indexOf(`persist:${account}`));
      assert.ok(events.indexOf(`persist:${account}`) < events.indexOf(`activities:Bearer new-${account}`));
    }
  } finally {
    axios.defaults.adapter = adapter;
  }
});
