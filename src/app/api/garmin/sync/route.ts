import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { garminConnections, garminPendingImports, garminDailyMetrics } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { decrypt } from "@/lib/garmin-crypto";
import { fetchRecentActivities, fetchDailyMetrics } from "@/lib/garmin-client";

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("MFA") || msg.includes("Ticket not found")) {
      return NextResponse.json({ error: "Garmin blocked this sign-in as a new device. Check your email for a Garmin security notification, confirm it was you, then try again." }, { status: 502 });
    }
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

  // Pull today's health metrics (RHR, HRV, sleep, calories). Best-effort — never
  // blocks the sync response if Garmin's wellness endpoints are unavailable.
  const today = new Date();
  try {
    const metrics = await fetchDailyMetrics(username, password, today);
    const dateStr = today.toISOString().slice(0, 10);
    await db
      .insert(garminDailyMetrics)
      .values({
        userId: user.id,
        date: dateStr,
        ...metrics,
      })
      .onConflictDoUpdate({
        target: [garminDailyMetrics.userId, garminDailyMetrics.date],
        set: {
          ...metrics,
          syncedAt: new Date(),
        },
      });
  } catch { /* optional metrics — never fail the sync */ }

  await db
    .update(garminConnections)
    .set({ lastSyncedAt: new Date() })
    .where(eq(garminConnections.userId, user.id));

  return NextResponse.json({ synced: activities.length, imported });
}
