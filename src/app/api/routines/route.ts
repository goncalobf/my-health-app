import { NextResponse } from "next/server";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { routines, routineExercises } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  const rows = await db
    .select({
      id: routines.id,
      name: routines.name,
      notes: routines.notes,
      archived: routines.archived,
      position: routines.position,
      exerciseCount: sql<number>`count(${routineExercises.id})::int`,
    })
    .from(routines)
    .leftJoin(routineExercises, eq(routineExercises.routineId, routines.id))
    .where(and(eq(routines.userId, user.id), eq(routines.archived, false)))
    .groupBy(routines.id)
    .orderBy(asc(routines.position), asc(routines.id));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${routines.position}), 0)::int` })
    .from(routines)
    .where(eq(routines.userId, user.id));
  const [row] = await db
    .insert(routines)
    .values({ userId: user.id, name, position: (max ?? 0) + 1 })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
