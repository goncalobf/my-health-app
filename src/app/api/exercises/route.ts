import { NextResponse } from "next/server";
import { asc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  const rows = await db.select().from(exercises).where(or(isNull(exercises.ownerUserId), eq(exercises.ownerUserId, user.id))).orderBy(asc(exercises.name));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const [row] = await db
    .insert(exercises)
    .values({
      ownerUserId: user.id,
      name,
      muscleGroup: body.muscleGroup ? String(body.muscleGroup) : null,
      notes: body.notes ? String(body.notes) : null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
