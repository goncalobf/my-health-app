import "server-only";
import { and, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/db/schema";

export type GarminTransaction = Parameters<Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]>[0];
const { garminAuthSessions, garminConnections, garminOperationState } = schema;
let store: NodePgDatabase<typeof schema> | undefined;

export async function withGarminAccount<T>(
  userId: number,
  work: (tx: GarminTransaction, state: typeof garminOperationState.$inferSelect) => Promise<T>,
): Promise<T> {
  if (!store) {
    const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!connectionString) throw new Error("Garmin database is not configured");
    store = drizzle(new Pool({ connectionString, max: 2, connectionTimeoutMillis: 4_000, allowExitOnIdle: true }), { schema });
  }
  // Lock one account for short writes only. Provider calls happen outside the transaction.
  return store.transaction(async (tx) => {
    await tx.execute(sql`set local statement_timeout = '5s'`);
    await tx.insert(garminOperationState).values({ userId }).onConflictDoNothing();
    const [state] = await tx.select().from(garminOperationState)
      .where(eq(garminOperationState.userId, userId)).for("update");
    return work(tx, state);
  });
}

const limits = {
  session: { max: 10, window: 30 * 60_000 },
  start: { max: 5, window: 30 * 60_000 },
  resume: { max: 10, window: 10 * 60_000 },
  sync: { max: 6, window: 60 * 60_000 },
};

export async function takeGarminAttempt(
  tx: GarminTransaction,
  state: typeof garminOperationState.$inferSelect,
  action: keyof typeof limits,
) {
  const now = Date.now();
  const previous = state.authRate[action];
  const limit = limits[action];
  const bucket = previous && previous.resetAt > now ? previous : { count: 0, resetAt: now + limit.window };
  if (bucket.count >= limit.max) return false;
  await tx.update(garminOperationState).set({
    authRate: { ...state.authRate, [action]: { ...bucket, count: bucket.count + 1 } },
  }).where(eq(garminOperationState.userId, state.userId));
  return true;
}

export async function cancelGarminSessions(tx: GarminTransaction, userId: number, keepId?: string) {
  const account = eq(garminAuthSessions.userId, userId);
  await tx.update(garminAuthSessions).set({ status: "cancelled", attemptId: null, challengeDigest: null })
    .where(and(account, inArray(garminAuthSessions.status, ["pending", "mfa", "busy"]),
      keepId ? sql`${garminAuthSessions.id} <> ${keepId}` : undefined));
}

export async function clearGarminSync(tx: GarminTransaction, userId: number) {
  await tx.update(garminOperationState).set({ syncLease: null, syncExpiresAt: null })
    .where(eq(garminOperationState.userId, userId));
}

export async function disconnectGarmin(userId: number) {
  await withGarminAccount(userId, async (tx) => {
    await cancelGarminSessions(tx, userId);
    await clearGarminSync(tx, userId);
    await tx.delete(garminConnections).where(eq(garminConnections.userId, userId));
  });
}

export class GarminSyncSuperseded extends Error {}

export function withGarminSync<T>(
  userId: number,
  lease: string,
  work: (tx: GarminTransaction) => Promise<T>,
): Promise<T> {
  return withGarminAccount(userId, (tx, state) => {
    if (state.syncLease !== lease || !state.syncExpiresAt || state.syncExpiresAt.getTime() <= Date.now()) {
      throw new GarminSyncSuperseded();
    }
    return work(tx);
  });
}

export async function pruneGarminSessions(tx: GarminTransaction, userId: number) {
  await tx.delete(garminAuthSessions).where(and(eq(garminAuthSessions.userId, userId),
    lt(garminAuthSessions.expiresAt, sql`now() - interval '1 day'`)));
}

export const garminSessionIsUnexpired = () => gt(garminAuthSessions.expiresAt, sql`clock_timestamp()`);
