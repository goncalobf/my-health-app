import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { db } from "@/db";
import { garminAuthSessions } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

// POST — create a one-time auth session for the current browser sign-in flow.
export async function POST() {
  const user = await requireAppUser();

  const id = randomUUID();
  const secret = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(garminAuthSessions).values({ id, userId: user.id, secret, expiresAt });

  return NextResponse.json({ id, secret });
}
