import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { measurementLogs } from "@/db/schema";
import { todayISO } from "@/lib/utils";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json(await db.select().from(measurementLogs).where(eq(measurementLogs.userId, user.id)).orderBy(asc(measurementLogs.day)));
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const numeric = (key: string) => body[key] === "" || body[key] == null ? null : Number(body[key]);
  const [row] = await db.insert(measurementLogs).values({
    userId: user.id,
    day: body.day || todayISO(),
    waistCm: numeric("waistCm"), chestCm: numeric("chestCm"), armsCm: numeric("armsCm"),
    thighsCm: numeric("thighsCm"), bodyFatPct: numeric("bodyFatPct"),
    notes: body.notes ? String(body.notes) : null,
    photoDataUrl: body.photoDataUrl ? String(body.photoDataUrl) : null,
  }).returning();
  return NextResponse.json(row, { status: 201 });
}
