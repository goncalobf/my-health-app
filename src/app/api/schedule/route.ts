import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { routines, workoutSchedule } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const update = z.object({
  entries: z.array(z.object({
    dayOfWeek: z.number().int().min(1).max(7),
    routineId: z.number().int().positive().max(2147483647).nullable(),
  })).length(7).refine((rows) => new Set(rows.map((row) => row.dayOfWeek)).size === 7),
});

async function readSchedule(userId: number) {
  const rows = await db
    .select({ dayOfWeek: workoutSchedule.dayOfWeek, routineId: routines.id, routineName: routines.name })
    .from(workoutSchedule)
    .leftJoin(routines, and(
      eq(routines.id, workoutSchedule.routineId),
      eq(routines.userId, userId),
      eq(routines.archived, false),
    ))
    .where(eq(workoutSchedule.userId, userId));

  return DAYS.map((day, i) => {
    const row = rows.find((item) => item.dayOfWeek === i + 1);
    return {
      dayOfWeek: i + 1,
      day,
      routineId: row?.routineId ?? null,
      routineName: row?.routineName ?? null,
    };
  });
}

export async function GET() {
  const user = await requireAppUser();
  return Response.json(await readSchedule(user.id));
}

export async function PUT(req: Request) {
  const user = await requireAppUser();
  const parsed = update.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid weekly schedule." }, { status: 400 });
  const { entries } = parsed.data;
  const ids = [...new Set(entries.flatMap(({ routineId }) => routineId === null ? [] : [routineId]))];
  if (ids.length) {
    const owned = await db.select({ id: routines.id }).from(routines)
      .where(and(eq(routines.userId, user.id), eq(routines.archived, false), inArray(routines.id, ids)));
    if (owned.length !== ids.length) return Response.json({ error: "Routine not found." }, { status: 404 });
  }

  await db.insert(workoutSchedule)
    .values(entries.map((entry) => ({ ...entry, userId: user.id })))
    .onConflictDoUpdate({
      target: [workoutSchedule.userId, workoutSchedule.dayOfWeek],
      set: { routineId: sql`excluded.routine_id` },
    });
  return Response.json(await readSchedule(user.id));
}
