import { db } from "@/db";
import { workoutDayChoices } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { todayISO } from "@/lib/utils";
import { workoutDayUpdate } from "@/lib/workout-day";
import { getWorkoutDay } from "@/lib/workout-day-data";

export async function GET() {
  const user = await requireAppUser();
  return Response.json(await getWorkoutDay(user.id, todayISO()));
}

export async function PUT(req: Request) {
  const user = await requireAppUser();
  const parsed = workoutDayUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid workout choice." }, { status: 400 });
  const day = todayISO();
  if (parsed.data.day !== day) {
    return Response.json({ error: "The date has changed. Refresh to choose today’s training." }, { status: 409 });
  }

  const plan = await getWorkoutDay(user.id, day);
  const { routineId, jiuJitsu } = parsed.data;
  if (routineId !== null && !plan.routines.some((routine) => routine.id === routineId)) {
    return Response.json({ error: "Routine not found." }, { status: 404 });
  }

  const selection = { routineId, jiuJitsu };
  const [choice] = await db.insert(workoutDayChoices)
    .values({ userId: user.id, day, ...selection })
    .onConflictDoUpdate({
      target: [workoutDayChoices.userId, workoutDayChoices.day],
      set: selection,
    })
    .returning({ routineId: workoutDayChoices.routineId, jiuJitsu: workoutDayChoices.jiuJitsu });
  return Response.json({ ...plan, choice });
}
