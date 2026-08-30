import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { garminConnections } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { encrypt } from "@/lib/garmin-crypto";
import { validateToken, type GarminToken } from "@/lib/garmin-client";

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

  const raw = String(body.token ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  let token: GarminToken;
  try {
    token = JSON.parse(raw) as GarminToken;
    if (!token.oauth1 || !token.oauth2) throw new Error("invalid shape");
  } catch {
    return NextResponse.json({ error: "Invalid token — paste the full JSON output from the garmin-auth script" }, { status: 400 });
  }

  // Validate the token works before storing it.
  try {
    await validateToken(token);
  } catch {
    return NextResponse.json({ error: "Token validation failed — it may be expired. Run the garmin-auth script again to get a fresh token." }, { status: 401 });
  }

  const encryptedData = encrypt(JSON.stringify(token));

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
