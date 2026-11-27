export const GARMIN_SIGN_IN_PARAM = "signed-in";
export const GARMIN_SIGN_IN_LANDING = `/?${GARMIN_SIGN_IN_PARAM}=1`;

const APP_OPEN_MAX_AGE_MS = 30 * 60_000;
const SIGN_IN_COALESCE_MS = 15_000;

// Only the server's verified session date and clock can determine freshness.
export function garminLoginSyncPlan(
  signedInAt: Date | null,
  lastSyncedAt: Date | null,
  lastActivitiesSyncedAt: Date | null,
  { justSignedIn = false, now = Date.now() }: { justSignedIn?: boolean; now?: number } = {},
) {
  const sessionTime = signedInAt?.getTime() ?? Number.NaN;
  const maxAge = justSignedIn ? SIGN_IN_COALESCE_MS : APP_OPEN_MAX_AGE_MS;
  const cutoff = Math.max(now - maxAge, Number.isFinite(sessionTime) && sessionTime <= now ? sessionTime : 0);
  const activities = !lastActivitiesSyncedAt || lastActivitiesSyncedAt.getTime() < cutoff;
  // A newer activity timestamp also records an outstanding health pull.
  const health = activities || !lastSyncedAt || lastSyncedAt.getTime() < cutoff
    || (lastActivitiesSyncedAt !== null && lastActivitiesSyncedAt > lastSyncedAt);
  return { activities, health };
}
