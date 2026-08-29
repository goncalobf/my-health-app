/**
 * Local development mode: no Neon Auth, no login page, its own throwaway
 * database. It exists so the UI can be opened and checked without credentials.
 *
 * The guards below are deliberately paranoid. This must never be reachable on
 * a deployment, so it requires an explicit opt-in flag AND the absence of any
 * Vercel environment AND a non-production build. Failing any one of these
 * leaves normal Neon Auth fully in force.
 */
export function isLocalMode(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.VERCEL_ENV) return false;
  if (process.env.NODE_ENV === "production") return false;
  return process.env.FITLOG_LOCAL === "1";
}

/** The account the local app is signed in as. */
export const LOCAL_USER_EMAIL = "local@fitlog.test";
export const LOCAL_USER_NAME = "Local Tester";
