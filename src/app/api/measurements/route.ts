import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { measurementLogs } from "@/db/schema";
import { todayISO } from "@/lib/utils";

export async function GET() {
  return NextResponse.json(await db.select().from(measurementLogs).orderBy(asc(measurementLogs.day)));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const numeric = (key: string) => body[key] === "" || body[key] == null ? null : Number(body[key]);
  const [row] = await db.insert(measurementLogs).values({
    day: body.day || todayISO(),
    waistCm: numeric("waistCm"), chestCm: numeric("chestCm"), armsCm: numeric("armsCm"),
    thighsCm: numeric("thighsCm"), bodyFatPct: numeric("bodyFatPct"),
    notes: body.notes ? String(body.notes) : null,
    photoDataUrl: body.photoDataUrl ? String(body.photoDataUrl) : null,
  }).returning();
  return NextResponse.json(row, { status: 201 });
}
