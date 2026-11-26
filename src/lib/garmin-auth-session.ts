import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { garminAuthSessions, garminConnections } from "@/db/schema";
import { encrypt } from "@/lib/garmin-crypto";
import type { GarminToken } from "@/lib/garmin-client";

export async function completeGarminAuthSession(
  sessionId: string,
  secret: string,
  token: GarminToken,
): Promise<boolean> {
  const encryptedData = encrypt(JSON.stringify(token));
  const pending = and(
    eq(garminAuthSessions.id, sessionId),
    eq(garminAuthSessions.secret, secret),
    eq(garminAuthSessions.status, "pending"),
    gt(garminAuthSessions.expiresAt, new Date()),
  );
  const consumed = db.$with("consumed").as(
    db.update(garminAuthSessions)
      .set({ status: "done" })
      .where(pending)
      .returning({ userId: garminAuthSessions.userId }),
  );
  const [saved] = await db.with(consumed).insert(garminConnections)
    .select(db.select({
      userId: consumed.userId,
      encryptedData: sql<string>`${encryptedData}`.as("encrypted_data"),
      lastSyncedAt: sql<Date | null>`null`.as("last_synced_at"),
      connectedAt: sql<Date>`now()`.as("connected_at"),
    }).from(consumed))
    .onConflictDoUpdate({
      target: garminConnections.userId,
      set: { encryptedData, connectedAt: new Date() },
    })
    .returning({ userId: garminConnections.userId });
  return Boolean(saved);
}

export async function failGarminAuthSession(
  sessionId: string,
  secret: string,
): Promise<boolean> {
  const [updated] = await db.update(garminAuthSessions)
    .set({ status: "error", errorMessage: "Garmin sign-in failed. Start over in Fitlog." })
    .where(and(
      eq(garminAuthSessions.id, sessionId),
      eq(garminAuthSessions.secret, secret),
      eq(garminAuthSessions.status, "pending"),
      gt(garminAuthSessions.expiresAt, new Date()),
    ))
    .returning({ id: garminAuthSessions.id });
  return Boolean(updated);
}
