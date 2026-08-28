import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { expenditureLogs } from "@/db/schema";
import { todayISO } from "@/lib/utils";

export async function GET() {
  return NextResponse.json(await db.select().from(expenditureLogs).orderBy(asc(expenditureLogs.day)));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const day = String(body.day || todayISO());
  const totalCalories = Number(body.totalCalories);
  if (!totalCalories || totalCalories < 500) {
    return NextResponse.json({ error: "Enter Garmin total calories" }, { status: 400 });
  }
  const activeCalories = body.activeCalories ? Number(body.activeCalories) : null;
  const [row] = await db.insert(expenditureLogs)
    .values({ day, totalCalories, activeCalories })
    .onConflictDoUpdate({ target: expenditureLogs.day, set: { totalCalories, activeCalories } })
    .returning();
  return NextResponse.json(row);
}
