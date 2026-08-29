import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { expenditureLogs } from "@/db/schema";
import { todayISO } from "@/lib/utils";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json(await db.select().from(expenditureLogs).where(eq(expenditureLogs.userId, user.id)).orderBy(asc(expenditureLogs.day)));
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const day = String(body.day || todayISO());
  const totalCalories = Number(body.totalCalories);
  if (!totalCalories || totalCalories < 500) {
    return NextResponse.json({ error: "Enter Garmin total calories" }, { status: 400 });
  }
  const activeCalories = body.activeCalories ? Number(body.activeCalories) : null;
  const [row] = await db.insert(expenditureLogs)
    .values({ userId: user.id, day, totalCalories, activeCalories })
    .onConflictDoUpdate({ target: [expenditureLogs.userId, expenditureLogs.day], set: { totalCalories, activeCalories } })
    .returning();
  return NextResponse.json(row);
}
