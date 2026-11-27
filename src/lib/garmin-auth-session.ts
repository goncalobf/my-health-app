import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { garminAuthSessions, garminConnections } from "@/db/schema";
import { encrypt } from "@/lib/garmin-crypto";
import type { GarminToken } from "@/lib/garmin-data";
import { cancelGarminSessions, clearGarminSync, garminSessionIsUnexpired, pruneGarminSessions,
  takeGarminAttempt, withGarminAccount } from "@/lib/garmin-operations";

type Purpose = "browser" | "legacy" | "manual";
type Handshake = { sessionId: string; secret: string };
type BrowserAttempt = Handshake & { action: "start" } | Handshake & { action: "resume"; state: string };
type SessionOwner = Handshake & { userId: number; purpose: Purpose };
const digest = (state: string) => createHash("sha256").update(state).digest("hex");

function pending(owner: SessionOwner) {
  return and(eq(garminAuthSessions.id, owner.sessionId), eq(garminAuthSessions.userId, owner.userId),
    eq(garminAuthSessions.secret, digest(owner.secret)), eq(garminAuthSessions.purpose, owner.purpose),
    garminSessionIsUnexpired());
}

export function beginGarminAuth(userId: number, purpose: Purpose) {
  return withGarminAccount(userId, async (tx, state) => {
    if (!await takeGarminAttempt(tx, state, "session")) return null;
    await pruneGarminSessions(tx, userId);
    await cancelGarminSessions(tx, userId);
    const id = randomUUID();
    const secret = randomBytes(32).toString("hex");
    await tx.insert(garminAuthSessions).values({ id, userId, secret: digest(secret), purpose, expiresAt: new Date(Date.now() + 600_000) });
    return { id, secret };
  });
}

export function claimGarminAuth(userId: number, body: BrowserAttempt) {
  return withGarminAccount(userId, async (tx, state) => {
    const where = and(
      pending({ ...body, userId, purpose: "browser" }),
      eq(garminAuthSessions.status, body.action === "start" ? "pending" : "mfa"),
      body.action === "resume" ? eq(garminAuthSessions.challengeDigest, digest(body.state)) : undefined,
    );
    const [session] = await tx.select({ id: garminAuthSessions.id }).from(garminAuthSessions).where(where);
    if (!session) return { status: "stale" } as const;
    if (!await takeGarminAttempt(tx, state, body.action)) return { status: "limited" } as const;
    const attemptId = randomUUID();
    const [claimed] = await tx.update(garminAuthSessions).set({ status: "busy", attemptId }).where(where)
      .returning({ id: garminAuthSessions.id });
    return claimed ? { status: "claimed", attemptId } as const : { status: "stale" } as const;
  });
}

export function settleGarminAuth(owner: SessionOwner, attemptId: string, state?: string) {
  return withGarminAccount(owner.userId, async (tx) => {
    const [row] = await tx.update(garminAuthSessions)
      .set({ status: state ? "mfa" : "error", attemptId: null, challengeDigest: state ? digest(state) : null })
      .where(and(pending(owner), eq(garminAuthSessions.status, "busy"), eq(garminAuthSessions.attemptId, attemptId)))
      .returning({ id: garminAuthSessions.id });
    return Boolean(row);
  });
}

export function completeGarminAuthSession(owner: SessionOwner, token: GarminToken, attemptId?: string) {
  const encryptedData = encrypt(JSON.stringify(token));
  return withGarminAccount(owner.userId, async (tx) => {
    const [session] = await tx.update(garminAuthSessions)
      .set({ status: "done", challengeDigest: null, attemptId: null })
      .where(and(pending(owner), eq(garminAuthSessions.status, attemptId ? "busy" : "pending"),
        attemptId ? eq(garminAuthSessions.attemptId, attemptId) : undefined))
      .returning({ userId: garminAuthSessions.userId });
    if (!session) return false;
    await tx.insert(garminConnections).values({ userId: owner.userId, encryptedData })
      .onConflictDoUpdate({
        target: garminConnections.userId,
        set: { encryptedData, connectedAt: new Date(), lastSyncedAt: null },
      });
    await cancelGarminSessions(tx, owner.userId, owner.sessionId);
    await clearGarminSync(tx, owner.userId);
    return true;
  });
}

export async function findLegacyGarminSession(sessionId: string, secret: string): Promise<SessionOwner | null> {
  const [session] = await db.select({ userId: garminAuthSessions.userId }).from(garminAuthSessions)
    .where(and(eq(garminAuthSessions.id, sessionId), eq(garminAuthSessions.secret, digest(secret)),
      eq(garminAuthSessions.purpose, "legacy"), eq(garminAuthSessions.status, "pending"), garminSessionIsUnexpired()));
  return session ? { userId: session.userId, sessionId, secret, purpose: "legacy" } : null;
}

export function failGarminAuthSession(owner: SessionOwner) {
  return withGarminAccount(owner.userId, async (tx) => {
    const [row] = await tx.update(garminAuthSessions).set({
      status: "error", errorMessage: "Garmin sign-in failed. Start over in Fitlog.",
    }).where(and(pending(owner), eq(garminAuthSessions.status, "pending"))).returning({ id: garminAuthSessions.id });
    return Boolean(row);
  });
}

export function cancelGarminAuth(userId: number, sessionId: string) {
  return withGarminAccount(userId, async (tx) => {
    await tx.update(garminAuthSessions).set({ status: "cancelled", challengeDigest: null, attemptId: null })
      .where(and(eq(garminAuthSessions.id, sessionId), eq(garminAuthSessions.userId, userId),
        eq(garminAuthSessions.purpose, "browser"), inArray(garminAuthSessions.status, ["pending", "mfa", "busy"])));
  });
}
