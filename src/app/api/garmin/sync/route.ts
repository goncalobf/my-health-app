import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { garminConnections, garminPendingImports, garminDailyMetrics } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { decrypt, encrypt } from "@/lib/garmin-crypto";
import { fetchWithToken, fetchDailyMetricsWithToken, type GarminToken } from "@/lib/garmin-client";

export async function POST() {
  const user = await requireAppUser();

  const [connection] = await db
    .select({ encryptedData: garminConnections.encryptedData })
    .from(garminConnections)
    .where(eq(garminConnections.userId, user.id));

  if (!connection) {
    return NextResponse.json({ error: "No Garmin account connected" }, { status: 400 });
  }

  let token = JSON.parse(decrypt(connection.encryptedData)) as GarminToken;

  let activities;
  try {
    const result = await fetchWithToken(token, 20);
    activities = result.activities;
    token = result.updatedToken; // may have been refreshed
  } catch {
    return NextResponse.json({ error: "Garmin sync failed — your token may have expired. Run the garmin-auth script again and reconnect." }, { status: 502 });
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

  // Pull today's health metrics. Best-effort — never blocks the sync response.
  const today = new Date();
  try {
    const { metrics, updatedToken } = await fetchDailyMetricsWithToken(token, today);
    token = updatedToken;
    const dateStr = today.toISOString().slice(0, 10);
    await db
      .insert(garminDailyMetrics)
      .values({ userId: user.id, date: dateStr, ...metrics })
      .onConflictDoUpdate({
        target: [garminDailyMetrics.userId, garminDailyMetrics.date],
        set: { ...metrics, syncedAt: new Date() },
      });
  } catch { /* optional metrics */ }

  // Persist the (possibly refreshed) token back to DB.
  await db
    .update(garminConnections)
    .set({ encryptedData: encrypt(JSON.stringify(token)), lastSyncedAt: new Date() })
    .where(eq(garminConnections.userId, user.id));

  return NextResponse.json({ synced: activities.length, imported });
}
