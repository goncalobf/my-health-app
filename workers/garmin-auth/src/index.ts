/**
 * Fitlog Garmin Auth Worker
 *
 * Authenticates with Garmin Connect from Cloudflare's edge, then sends the
 * resulting OAuth token to Fitlog. Credentials are used once and never stored.
 */

// Cloudflare Workers do not accept Axios' `cache` Request option. Patch both
// globals before requiring garmin-connect so its internal requests stay valid.
function stripCache(init?: RequestInit): RequestInit | undefined {
  if (!init || !("cache" in init)) return init;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cache, ...safe } = init as RequestInit & { cache?: unknown };
  return safe as RequestInit;
}

const nativeFetch = globalThis.fetch;
(globalThis as Record<string, unknown>).fetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => nativeFetch(input, stripCache(init));

const NativeRequest = globalThis.Request;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as Record<string, unknown>).Request = class PatchedRequest extends (NativeRequest as any) {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, stripCache(init));
  }
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GarminConnect } = require("garmin-connect");

const ALLOWED_ORIGINS = new Set([
  "https://fitlog.site",
  "https://www.fitlog.site",
]);
const FITLOG_CALLBACK_URL = "https://fitlog.site/api/garmin/auth-callback";
const GARMIN_LOGIN_TIMEOUT_MS = 40_000;
const CALLBACK_TIMEOUT_MS = 8_000;

type CallbackPayload = {
  sessionId: string;
  secret: string;
  token?: unknown;
  error?: string;
};

function isAllowedOrigin(origin: string | null): origin is string {
  return origin !== null && ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function safeGarminError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "GARMIN_LOGIN_TIMEOUT") {
    return "Garmin sign-in timed out. Please try again.";
  }
  if (/MFA|Ticket not found|password|locked|verification/i.test(message)) {
    return "Garmin rejected the sign-in or requires account verification.";
  }
  return "Garmin sign-in failed. Please try again.";
}

async function postCallback(payload: CallbackPayload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);

  try {
    return await nativeFetch(FITLOG_CALLBACK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const worker = {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get("Origin");

    if (!isAllowedOrigin(origin)) {
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    let body: {
      username?: string;
      password?: string;
      sessionId?: string;
      secret?: string;
    };

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, origin);
    }

    const { username, password, sessionId, secret } = body;
    if (!username || !password || !sessionId || !secret) {
      return json({ error: "Missing required sign-in fields" }, 400, origin);
    }

    let token: unknown;
    try {
      const garmin = new GarminConnect({ username, password });
      await withTimeout(
        garmin.login(username, password),
        GARMIN_LOGIN_TIMEOUT_MS,
        "GARMIN_LOGIN_TIMEOUT",
      );
      token = garmin.exportToken();
    } catch (error: unknown) {
      const safeError = safeGarminError(error);
      console.warn("Garmin authentication failed:", safeError);
      await postCallback({ sessionId, secret, error: safeError }).catch(() => undefined);
      return json({ error: safeError }, 502, origin);
    }

    try {
      const response = await postCallback({ sessionId, secret, token });
      if (!response.ok) {
        console.warn("Fitlog rejected the Garmin authentication callback");
        return json({ error: "Fitlog could not save the Garmin connection." }, 502, origin);
      }
    } catch {
      console.warn("Fitlog Garmin authentication callback timed out");
      return json({ error: "Fitlog could not save the Garmin connection." }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  },
};

export default worker;
