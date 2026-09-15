import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, routines, trainingPlanState } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

import { getRoutinePrescription } from "@/lib/workout-plan-data";
import { createSession } from "@/lib/training-validation";

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
  const parsed = createSession.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  const body = parsed.data;
  const routineId = body.routineId ?? null;

  let name = "Quick workout";
  if (routineId) {
    const [r] = await db
      .select({ name: routines.name })
      .from(routines)
      .where(and(eq(routines.id, routineId), eq(routines.userId, user.id)));
    if (!r)
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    name = r.name;
  }
  if (body.name) name = String(body.name);

  const plan = routineId
    ? await getRoutinePrescription(user.id, routineId)
    : [];
  const [state] = await db
    .select({ isDeload: trainingPlanState.isDeload })
    .from(trainingPlanState)
    .where(eq(trainingPlanState.userId, user.id));
  const [row] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      routineId,
      name,
      prescriptionSnapshot: {
        version: 1,
        isDeload: state?.isDeload ?? false,
        plan,
      },
    })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
