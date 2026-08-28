import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, routines } from "@/db/schema";

export async function GET() {
  const rows = await db
    .select({
      id: sessions.id,
      name: sessions.name,
      startedAt: sessions.startedAt,
      finishedAt: sessions.finishedAt,
      routineId: sessions.routineId,
    })
    .from(sessions)
    .orderBy(desc(sessions.startedAt))
    .limit(50);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const routineId = body.routineId ? Number(body.routineId) : null;

  let name = "Quick workout";
  if (routineId) {
    const [r] = await db
      .select({ name: routines.name })
      .from(routines)
      .where(eq(routines.id, routineId));
    if (r) name = r.name;
  }
  if (body.name) name = String(body.name);

  const [row] = await db
    .insert(sessions)
    .values({ routineId, name })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
