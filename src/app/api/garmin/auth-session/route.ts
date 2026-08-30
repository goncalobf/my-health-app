import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";
import { db } from "@/db";
import { garminAuthSessions } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

// POST — create a new pending auth session. Browser calls this, then polls [id].
export async function POST() {
  const user = await requireAppUser();

  const id = randomUUID();
  const secret = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.insert(garminAuthSessions).values({ id, userId: user.id, secret, expiresAt });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fitlog.site";

  return NextResponse.json({
    id,
    secret,
    // Full command the user pastes into their terminal
    command: `node scripts/garmin-auth.mjs ${id} ${secret} ${appUrl}`,
  });
}
