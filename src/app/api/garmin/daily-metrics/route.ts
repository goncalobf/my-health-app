import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { garminDailyMetrics } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { garminPrivateHeaders } from "@/lib/garmin-browser-request";
import { shiftISODate, todayISO } from "@/lib/utils";

// GET /api/garmin/daily-metrics?days=7
export async function GET(req: Request) {
  const user = await requireAppUser();
  const { searchParams } = new URL(req.url);
  const requestedDays = Number(searchParams.get("days") ?? "7");
  const days = Number.isFinite(requestedDays) ? Math.min(Math.max(Math.trunc(requestedDays), 1), 90) : 7;
  const today = todayISO();

  const rows = await db
    .select()
    .from(garminDailyMetrics)
    .where(
      and(
        eq(garminDailyMetrics.userId, user.id),
        gte(garminDailyMetrics.date, shiftISODate(today, 1 - days)),
        lte(garminDailyMetrics.date, today)
      )
    )
    .orderBy(desc(garminDailyMetrics.date));

  return Response.json(rows, { headers: garminPrivateHeaders });
}
