import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const cookieSecret =
  process.env.NEON_AUTH_COOKIE_SECRET ??
  (process.env.AUTH_SECRET
    ? `fitlog-neon-auth-cookie:${process.env.AUTH_SECRET}`
    : "fitlog-local-development-cookie-secret");

if (!baseUrl) {
  throw new Error("NEON_AUTH_BASE_URL must be configured.");
}
if (!cookieSecret || cookieSecret.length < 32) {
  throw new Error(
    "NEON_AUTH_COOKIE_SECRET (or AUTH_SECRET) must contain at least 32 characters."
  );
}

export const auth = createNeonAuth({
  baseUrl,
  cookies: {
    secret: cookieSecret,
    sessionDataTtl: 300,
  },
});
