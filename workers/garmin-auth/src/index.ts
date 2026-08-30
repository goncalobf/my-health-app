/**
 * Fitlog Garmin Auth Worker
 *
 * Authenticates with Garmin Connect from Cloudflare's edge IP (not a flagged
 * datacenter IP) then POSTs the OAuth token back to the Fitlog server.
 *
 * Called by the browser with { username, password, sessionId, secret, callbackUrl }.
 * Never stores credentials — they're used once to get a token and discarded.
 */

// Cloudflare Workers don't implement the `cache` field on RequestInitializerDict.
// Axios (used by garmin-connect) passes cache:'default' to both fetch() AND the
// Request() constructor. Patch both globals before requiring garmin-connect so
// every call inside the library uses the safe wrappers.
function stripCache(init?: RequestInit): RequestInit | undefined {
  if (!init || !("cache" in init)) return init;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cache, ...safe } = init as RequestInit & { cache?: unknown };
  return safe as RequestInit;
}

const _nativeFetch = globalThis.fetch;
(globalThis as Record<string, unknown>).fetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => _nativeFetch(input, stripCache(init));

const _NativeRequest = globalThis.Request;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as Record<string, unknown>).Request = class PatchedRequest extends (_NativeRequest as any) {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(input, stripCache(init));
  }
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GarminConnect } = require("garmin-connect");

const ALLOWED_ORIGINS = [
  "https://fitlog.site",
  "https://www.fitlog.site",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

const worker = {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get("Origin");

    // CORS preflight
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
      callbackUrl?: string;
    };

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, origin);
    }

    const { username, password, sessionId, secret, callbackUrl } = body;

    if (!username || !password || !sessionId || !secret || !callbackUrl) {
      return json({ error: "username, password, sessionId, secret, and callbackUrl are required" }, 400, origin);
    }

    // Authenticate with Garmin from Cloudflare's IP
    let token: unknown;
    try {
      const gc = new GarminConnect({ username, password });
      await gc.login(username, password);
      token = gc.exportToken();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // Forward the error to the app so the browser poll can surface it
      await fetch(`${callbackUrl}/api/garmin/auth-callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, secret, error: msg }),
      }).catch(() => {});
      return json({ error: msg }, 502, origin);
    }

    // Send the token back to the Fitlog server
    try {
      const res = await fetch(`${callbackUrl}/api/garmin/auth-callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, secret, token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        return json({ error: err.error ?? "Callback failed" }, 502, origin);
      }
    } catch {
      return json({ error: "Could not reach Fitlog server" }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  },
};

export default worker;
