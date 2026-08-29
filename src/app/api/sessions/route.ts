import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, routines } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  const rows = await db
    .select({
      id: sessions.id,
      name: sessions.name,
      startedAt: sessions.startedAt,
      finishedAt: sessions.finishedAt,
      routineId: sessions.routineId,
    })
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.startedAt))
    .limit(50);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const routineId = body.routineId ? Number(body.routineId) : null;

  let name = "Quick workout";
  if (routineId) {
    const [r] = await db
      .select({ name: routines.name })
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.userId, user.id)));
    if (!r) return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    name = r.name;
  }
  if (body.name) name = String(body.name);

  const [row] = await db
    .insert(sessions)
    .values({ userId: user.id, routineId, name })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
