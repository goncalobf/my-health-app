import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { routines, workoutSchedule } from "@/db/schema";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export async function GET() {
  const rows = await db
    .select({ dayOfWeek: workoutSchedule.dayOfWeek, routineId: workoutSchedule.routineId, routineName: routines.name })
    .from(workoutSchedule)
    .leftJoin(routines, eq(routines.id, workoutSchedule.routineId))
    .orderBy(asc(workoutSchedule.dayOfWeek));

  if (rows.length) {
    return NextResponse.json(DAYS.map((day, i) => ({
      dayOfWeek: i + 1,
      day,
      routineId: rows.find((r) => r.dayOfWeek === i + 1)?.routineId ?? null,
      routineName: rows.find((r) => r.dayOfWeek === i + 1)?.routineName ?? null,
    })));
  }

  const available = await db.select({ id: routines.id, name: routines.name }).from(routines);
  const find = (term: string) => available.find((r) => r.name.toLowerCase().includes(term)) ?? null;
  const push = find("push");
  const pull = find("pull");
  const legs = find("leg");
  const inferred = [push, pull, legs, push, pull, legs, null];
  return NextResponse.json(DAYS.map((day, i) => ({
    dayOfWeek: i + 1,
    day,
    routineId: inferred[i]?.id ?? null,
    routineName: inferred[i]?.name ?? null,
  })));
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const entries = Array.isArray(body.entries) ? body.entries : [];
  for (let day = 1; day <= 7; day++) {
    const entry = entries.find((x: { dayOfWeek?: number }) => Number(x.dayOfWeek) === day);
    const routineId = entry?.routineId ? Number(entry.routineId) : null;
    await db.insert(workoutSchedule).values({ dayOfWeek: day, routineId })
      .onConflictDoUpdate({ target: workoutSchedule.dayOfWeek, set: { routineId } });
  }
  return GET();
}
