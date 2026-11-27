export function shouldSyncGarminOnLogin(signedInAt: Date | null, lastSyncedAt: Date | null) {
  return signedInAt !== null
    && Number.isFinite(signedInAt.getTime())
    && (lastSyncedAt === null || lastSyncedAt < signedInAt);
}

// lastSyncedAt records a complete pull. A newer activity timestamp means
// the health part of that pull remains outstanding.
export function garminLoginSyncPlan(
  signedInAt: Date | null,
  lastSyncedAt: Date | null,
  lastActivitiesSyncedAt: Date | null,
) {
  const activities = shouldSyncGarminOnLogin(signedInAt, lastActivitiesSyncedAt);
  const health = activities || shouldSyncGarminOnLogin(signedInAt, lastSyncedAt)
    || (signedInAt !== null && lastActivitiesSyncedAt !== null && lastSyncedAt !== null
      && lastActivitiesSyncedAt >= signedInAt && lastActivitiesSyncedAt > lastSyncedAt);
  return { activities, health };
}
