import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { garminAuthSessions, garminConnections } from "@/db/schema";
import { encrypt } from "@/lib/garmin-crypto";
import type { GarminToken } from "@/lib/garmin-client";

// POST — called by the Cloudflare Worker (not the browser). No session cookie required.
// Secured by the one-time secret generated when the session was created.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    sessionId?: string;
    secret?: string;
    token?: GarminToken;
    error?: string; // set by Worker on Garmin auth failure
  };

  if (!body.sessionId || !body.secret) {
    return NextResponse.json({ error: "sessionId and secret are required" }, { status: 400 });
  }

  const [session] = await db
    .select()
    .from(garminAuthSessions)
    .where(and(
      eq(garminAuthSessions.id, body.sessionId),
      eq(garminAuthSessions.secret, body.secret),
      eq(garminAuthSessions.status, "pending"),
    ));

  if (!session) {
    return NextResponse.json({ error: "Session not found, already used, or expired" }, { status: 404 });
  }
  if (session.expiresAt < new Date()) {
    return NextResponse.json({ error: "Session expired — start over in the app" }, { status: 410 });
  }

  // Worker reported a Garmin auth failure
  if (body.error) {
    await db
      .update(garminAuthSessions)
      .set({ status: "error", errorMessage: body.error })
      .where(eq(garminAuthSessions.id, body.sessionId));
    return NextResponse.json({ ok: true });
  }

  if (!body.token?.oauth1 || !body.token?.oauth2) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const encryptedData = encrypt(JSON.stringify(body.token));

  await db
    .insert(garminConnections)
    .values({ userId: session.userId, encryptedData })
    .onConflictDoUpdate({
      target: garminConnections.userId,
      set: { encryptedData, connectedAt: new Date() },
    });

  await db
    .update(garminAuthSessions)
    .set({ status: "done" })
    .where(eq(garminAuthSessions.id, body.sessionId));

  return NextResponse.json({ ok: true });
}
