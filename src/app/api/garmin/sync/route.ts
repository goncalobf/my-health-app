import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { garminConnections, garminDailyMetrics, garminOperationState, garminPendingImports } from "@/db/schema";
import { requireAppAccess } from "@/lib/app-user";
import { garminDenied, garminPrivateHeaders, isGarminBrowserRequest } from "@/lib/garmin-browser-request";
import { createGarminClient, GarminAuthenticationFailed, isGarminToken, type GarminToken } from "@/lib/garmin-client";
import { decrypt, encrypt } from "@/lib/garmin-crypto";
import { clearGarminSync, GarminSyncSuperseded, takeGarminAttempt, withGarminAccount, withGarminSync } from "@/lib/garmin-operations";
import { garminLoginSyncPlan } from "@/lib/garmin-sync-on-login";
import { todayISO } from "@/lib/utils";

export const maxDuration = 60;

function reply(data: object, status = 200) {
  return Response.json(data, { status, headers: garminPrivateHeaders });
}

export async function POST(req: Request) {
  if (!isGarminBrowserRequest(req)) return garminDenied();
  const { user: { id: userId }, signedInAt } = await requireAppAccess();
  const onLogin = new URL(req.url).searchParams.get("trigger") === "login";
  const lease = randomUUID();
  const started = await withGarminAccount(userId, async (tx, state) => {
    if (state.syncLease && state.syncExpiresAt && state.syncExpiresAt.getTime() > Date.now()) {
      return { status: "busy" } as const;
    }
    const [connection] = await tx.select({
      encryptedData: garminConnections.encryptedData,
      lastSyncedAt: garminConnections.lastSyncedAt,
      lastActivitiesSyncedAt: garminConnections.lastActivitiesSyncedAt,
    }).from(garminConnections).where(eq(garminConnections.userId, userId));
    if (!connection) {
      return onLogin ? { status: "skipped" } as const : { status: "disconnected" } as const;
    }
    const plan = garminLoginSyncPlan(signedInAt, connection.lastSyncedAt, connection.lastActivitiesSyncedAt);
    if (onLogin && !plan.health) return { status: "skipped" } as const;
    const pullActivities = !onLogin || plan.activities;
    if (!await takeGarminAttempt(tx, state, "sync")) return { status: "limited" } as const;
    await tx.update(garminOperationState)
      .set({ syncLease: lease, syncExpiresAt: new Date(Date.now() + 60_000) })
      .where(eq(garminOperationState.userId, userId));
    return { status: "started", encryptedData: connection.encryptedData, pullActivities } as const;
  }).catch(() => null);
  if (!started) return reply({ error: "Could not start Garmin sync. Try again shortly." }, 503);
  if (started.status === "skipped") return new Response(null, { status: 204, headers: garminPrivateHeaders });
  if (started.status === "busy") return reply({ error: "A Garmin sync is already running.", code: "sync_busy" }, 409);
  if (started.status === "disconnected") return reply({ error: "No Garmin account connected." }, 400);
  if (started.status === "limited") return reply({ error: "Too many sync requests. Try again later." }, 429);

  const connection = eq(garminConnections.userId, userId);
  try {
    const day = todayISO();
    let token: GarminToken;
    try {
      const parsed: unknown = JSON.parse(decrypt(started.encryptedData));
      if (!isGarminToken(parsed)) throw new Error("Invalid token shape");
      token = parsed;
    } catch {
      throw new GarminAuthenticationFailed();
    }
    const garmin = createGarminClient(token, {
      signal: AbortSignal.timeout(42_000),
      onRefresh: async (updated) => {
        const encryptedData = encrypt(JSON.stringify(updated));
        await withGarminSync(userId, lease, async (tx) => {
          await tx.update(garminConnections).set({ encryptedData }).where(connection);
        });
      },
    });
    const activities = started.pullActivities ? await garmin.activities() : [];
    const { metrics, incomplete } = await garmin.dailyMetrics(day, AbortSignal.timeout(12_000));
    const imported = await withGarminSync(userId, lease, async (tx) => {
      const inserted = activities.length ? await tx.insert(garminPendingImports)
        .values(activities.map((activity) => ({
          userId,
          garminActivityId: String(activity.activityId),
          garminActivityType: activity.activityType.typeKey,
          garminDataJson: JSON.stringify(activity),
        })))
        .onConflictDoNothing({ target: [garminPendingImports.userId, garminPendingImports.garminActivityId] })
        .returning({ id: garminPendingImports.id }) : [];
      const syncedAt = new Date();
      if (Object.keys(metrics).length) {
        await tx.insert(garminDailyMetrics).values({ userId, date: day, ...metrics, syncedAt })
          .onConflictDoUpdate({
            target: [garminDailyMetrics.userId, garminDailyMetrics.date],
            set: { ...metrics, syncedAt },
          });
      }
      if (started.pullActivities || !incomplete) {
        await tx.update(garminConnections).set({
          ...(started.pullActivities && { lastActivitiesSyncedAt: syncedAt }),
          ...(!incomplete && { lastSyncedAt: syncedAt }),
        }).where(connection);
      }
      await clearGarminSync(tx, userId);
      return inserted.length;
    });
    return reply({ synced: activities.length, imported, incomplete });
  } catch (error) {
    await withGarminSync(userId, lease, (tx) => clearGarminSync(tx, userId)).catch(() => {});
    if (error instanceof GarminSyncSuperseded
      || (error instanceof Error && error.cause instanceof GarminSyncSuperseded)) {
      return reply({ error: "The Garmin connection changed during sync. Try again." }, 409);
    }
    if (error instanceof GarminAuthenticationFailed) {
      return reply({ error: "Garmin rejected this connection. Reconnect your Garmin account and try again." }, 502);
    }
    return reply({ error: "Garmin sync failed. Try again shortly." }, 502);
  }
}
