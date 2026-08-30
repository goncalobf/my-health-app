import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { garminConnections, garminPendingImports } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { decrypt } from "@/lib/garmin-crypto";
import { fetchRecentActivities } from "@/lib/garmin-client";

export async function POST() {
  const user = await requireAppUser();

  const [connection] = await db
    .select({ encryptedData: garminConnections.encryptedData })
    .from(garminConnections)
    .where(eq(garminConnections.userId, user.id));

  if (!connection) {
    return NextResponse.json({ error: "No Garmin account connected" }, { status: 400 });
  }

  const { username, password } = JSON.parse(decrypt(connection.encryptedData)) as {
    username: string;
    password: string;
  };

  let activities;
  try {
    activities = await fetchRecentActivities(username, password, 20);
  } catch {
    return NextResponse.json({ error: "Garmin sync failed — reconnect your account" }, { status: 502 });
  }

  let imported = 0;
  for (const activity of activities) {
    const garminActivityId = String(activity.activityId);
    try {
      await db
        .insert(garminPendingImports)
        .values({
          userId: user.id,
          garminActivityId,
          garminActivityType: activity.activityType?.typeKey ?? "other",
          garminDataJson: JSON.stringify(activity),
        })
        .onConflictDoNothing();
      imported++;
    } catch {
      // Skip duplicate or malformed entries
    }
  }

  await db
    .update(garminConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(garminConnections.userId, user.id));

  return NextResponse.json({ synced: activities.length, imported });
}
