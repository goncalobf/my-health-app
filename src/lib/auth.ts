import "server-only";
import { createNeonAuth, type NeonAuth } from "@neondatabase/auth/next/server";

function resolveCookieSecret() {
  return (
    process.env.NEON_AUTH_COOKIE_SECRET ??
    (process.env.AUTH_SECRET
      ? `fitlog-neon-auth-cookie:${process.env.AUTH_SECRET}`
      : "fitlog-local-development-cookie-secret")
  );
}

/**
 * Whether this environment carries the configuration Neon Auth needs. A
 * deployment without it must deny access rather than serve the application.
 */
export function isAuthConfigured() {
  return (
    Boolean(process.env.NEON_AUTH_BASE_URL) && resolveCookieSecret().length >= 32
  );
}

let _auth: NeonAuth | null = null;

function getAuth(): NeonAuth {
  if (_auth) return _auth;
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = resolveCookieSecret();
  if (!baseUrl) {
    throw new Error("NEON_AUTH_BASE_URL must be configured.");
  }
  if (!cookieSecret || cookieSecret.length < 32) {
    throw new Error(
      "NEON_AUTH_COOKIE_SECRET (or AUTH_SECRET) must contain at least 32 characters."
    );
  }
  _auth = createNeonAuth({
    baseUrl,
    cookies: {
      secret: cookieSecret,
      sessionDataTtl: 300,
    },
  });
  return _auth;
}

// Lazy proxy so importing this module never throws while Next.js collects page
// data. Environments missing configuration fail on the request instead of the
// build, which mirrors how `src/db` defers its connection.
export const auth = new Proxy({} as NeonAuth, {
  get(_target, prop) {
    const instance = getAuth();
    const value = instance[prop as keyof NeonAuth];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
