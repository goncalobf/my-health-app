import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { exercises } from "@/db/schema";

export async function GET() {
  const rows = await db.select().from(exercises).orderBy(asc(exercises.name));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const [row] = await db
    .insert(exercises)
    .values({
      name,
      muscleGroup: body.muscleGroup ? String(body.muscleGroup) : null,
      notes: body.notes ? String(body.notes) : null,
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
