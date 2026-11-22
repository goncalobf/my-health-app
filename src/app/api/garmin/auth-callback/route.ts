import { and, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { garminAuthSessions, garminConnections } from "@/db/schema";
import { encrypt } from "@/lib/garmin-crypto";

const handshake = z.object({
  sessionId: z.string().uuid(),
  secret: z.string().regex(/^[a-f0-9]{64}$/),
});
const callback = z.union([
  handshake.extend({ error: z.string().min(1).max(500) }),
  handshake.extend({
    token: z.object({
      oauth1: z.record(z.unknown()),
      oauth2: z.record(z.unknown()),
    }),
  }),
]);

// Only the worker's one-time secret authorizes this browser-session-free route.
export async function POST(req: Request) {
  const parsed = callback.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid Garmin callback." }, { status: 400 });
  const body = parsed.data;
  const pending = and(
    eq(garminAuthSessions.id, body.sessionId),
    eq(garminAuthSessions.secret, body.secret),
    eq(garminAuthSessions.status, "pending"),
    gt(garminAuthSessions.expiresAt, new Date()),
  );

  try {
    if ("error" in body) {
      const [updated] = await db.update(garminAuthSessions)
        .set({ status: "error", errorMessage: "Garmin sign-in failed. Start over in Fitlog." })
        .where(pending)
        .returning({ id: garminAuthSessions.id });
      if (updated) return Response.json({ ok: true });
    } else {
      const encryptedData = encrypt(JSON.stringify(body.token));
      // Consume the handshake and store the token in one statement. A failed
      // connection write rolls back consumption, and a replay updates no rows.
      const consumed = db.$with("consumed").as(
        db.update(garminAuthSessions).set({ status: "done" }).where(pending)
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
      if (saved) return Response.json({ ok: true });
    }
    return Response.json({ error: "Session not found, already used, or expired." }, { status: 404 });
  } catch {
    return Response.json({ error: "Could not save the Garmin connection." }, { status: 502 });
  }
}
