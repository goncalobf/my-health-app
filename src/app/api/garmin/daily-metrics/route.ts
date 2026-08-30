import { NextResponse } from "next/server";
import { and, eq, gte, desc } from "drizzle-orm";
import { db } from "@/db";
import { garminDailyMetrics } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

// GET /api/garmin/daily-metrics?days=7
export async function GET(req: Request) {
  const user = await requireAppUser();
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get("days") ?? "7"), 1), 90);

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(garminDailyMetrics)
    .where(
      and(
        eq(garminDailyMetrics.userId, user.id),
        gte(garminDailyMetrics.date, sinceStr)
      )
    )
    .orderBy(desc(garminDailyMetrics.date));

  return NextResponse.json(rows);
}
