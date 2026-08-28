import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bodyweightLogs, settings } from "@/db/schema";
import { todayISO } from "@/lib/utils";

export async function GET() {
  const rows = await db
    .select()
    .from(bodyweightLogs)
    .orderBy(asc(bodyweightLogs.day));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const weightKg = Number(body.weightKg);
  if (!weightKg || weightKg <= 0) {
    return NextResponse.json({ error: "weightKg required" }, { status: 400 });
  }
  const [row] = await db
    .insert(bodyweightLogs)
    .values({ day: body.day || todayISO(), weightKg })
    .returning();
  await db
    .update(settings)
    .set({ currentWeightKg: weightKg })
    .where(eq(settings.id, 1));
  return NextResponse.json(row, { status: 201 });
}
