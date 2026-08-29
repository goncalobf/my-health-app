import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bodyweightLogs, settings } from "@/db/schema";
import { todayISO } from "@/lib/utils";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  const rows = await db
    .select()
    .from(bodyweightLogs)
    .where(eq(bodyweightLogs.userId, user.id))
    .orderBy(asc(bodyweightLogs.day));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const weightKg = Number(body.weightKg);
  if (!weightKg || weightKg <= 0) {
    return NextResponse.json({ error: "weightKg required" }, { status: 400 });
  }
  const [row] = await db
    .insert(bodyweightLogs)
    .values({ userId: user.id, day: body.day || todayISO(), weightKg })
    .returning();
  await db
    .update(settings)
    .set({ currentWeightKg: weightKg })
    .where(eq(settings.userId, user.id));
  return NextResponse.json(row, { status: 201 });
}
