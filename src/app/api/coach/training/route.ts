import { requireAppUser } from "@/lib/app-user";
import { getWorkoutDay, getTrainingSuggestionContext } from "@/lib/workout-day-data";
import { formatTrainingSuggestionContext } from "@/lib/coach-snapshot-markdown";
import { isCoachConfigured, structuredCoachResponse } from "@/lib/openai";
import { isRateLimited } from "@/lib/rate-limit";
import { todayISO } from "@/lib/utils";
import { trainingSuggestion, workoutDayUpdate } from "@/lib/workout-day";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["upcoming"],
  properties: {
    upcoming: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["routineId", "reason"],
        properties: {
          routineId: { type: ["integer", "null"] },
          reason: { type: "string" },
        },
      },
    },
  },
};

export async function POST(req: Request) {
  const user = await requireAppUser();
  const parsed = workoutDayUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid workout choice." }, { status: 400 });
  if (!isCoachConfigured()) {
    return Response.json({ error: "AI Coach is currently unavailable." }, { status: 503 });
  }
  if (isRateLimited(`coach-training:${user.id}`, { max: 10, windowMs: 10 * 60 * 1000 })) {
    return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  try {
    const day = todayISO();
    const plan = await getWorkoutDay(user.id, day);
    if (
      parsed.data.day !== day ||
      !plan.choice ||
      parsed.data.routineId !== plan.choice.routineId ||
      (parsed.data.jiuJitsu !== undefined && parsed.data.jiuJitsu !== plan.choice.jiuJitsu)
    ) {
      return Response.json({ error: "Today’s choice has changed. Refresh and try again." }, { status: 409 });
    }
    const context = await getTrainingSuggestionContext(user.id, plan);
    const result = trainingSuggestion.safeParse(await structuredCoachResponse<unknown>({
      name: "fitlog_training_suggestions",
      schema,
      data: formatTrainingSuggestionContext(plan, context),
    }));
    if (!result.success || result.data.upcoming.some(({ routineId }) =>
      routineId !== null && !plan.routines.some((routine) => routine.id === routineId))) {
      return Response.json({ error: "Coach returned an invalid training suggestion. Try again." }, { status: 502 });
    }
    return Response.json(result.data);
  } catch {
    return Response.json({ error: "Could not get training suggestions. Try again." }, { status: 502 });
  }
}
