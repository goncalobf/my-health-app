import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { garminConnections } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { encrypt } from "@/lib/garmin-crypto";
import { fetchRecentActivities } from "@/lib/garmin-client";

export async function GET() {
  const user = await requireAppUser();
  const [row] = await db
    .select({ connectedAt: garminConnections.connectedAt, lastSyncedAt: garminConnections.lastSyncedAt })
    .from(garminConnections)
    .where(eq(garminConnections.userId, user.id));
  return NextResponse.json({ connected: !!row, connectedAt: row?.connectedAt ?? null, lastSyncedAt: row?.lastSyncedAt ?? null });
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  if (!username || !password) {
    return NextResponse.json({ error: "username and password are required" }, { status: 400 });
  }

  // Verify credentials before storing by attempting a login.
  try {
    await fetchRecentActivities(username, password, 1);
  } catch {
    return NextResponse.json({ error: "Garmin login failed — check your username and password" }, { status: 401 });
  }

  const encryptedData = encrypt(JSON.stringify({ username, password }));

  await db
    .insert(garminConnections)
    .values({ userId: user.id, encryptedData })
    .onConflictDoUpdate({
      target: garminConnections.userId,
      set: { encryptedData, connectedAt: new Date() },
    });

  return NextResponse.json({ connected: true });
}

export async function DELETE() {
  const user = await requireAppUser();
  await db.delete(garminConnections).where(eq(garminConnections.userId, user.id));
  return new NextResponse(null, { status: 204 });
}
