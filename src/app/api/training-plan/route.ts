import { NextResponse } from "next/server";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { trainingCheckins, trainingPlanState } from "@/db/schema";
import { getTrainingInsights } from "@/lib/training-insights-data";
import { shiftISODate, todayISO } from "@/lib/utils";
import { buildTrainingPlanStatus } from "@/lib/training-plan";
import { requireAppUser } from "@/lib/app-user";

import { trainingPlanUpdate } from "@/lib/training-validation";

async function ensureState(userId: number) {
  await db
    .insert(trainingPlanState)
    .values({
      userId,
      planName: "My training plan",
      blockStartedOn: todayISO(),
    })
    .onConflictDoNothing({ target: trainingPlanState.userId });
}

export async function GET() {
  const user = await requireAppUser();
  await ensureState(user.id);
  const [state] = await db
    .select()
    .from(trainingPlanState)
    .where(eq(trainingPlanState.userId, user.id));
  const checkins = await db
    .select()
    .from(trainingCheckins)
    .where(
      and(
        eq(trainingCheckins.userId, user.id),
        gte(trainingCheckins.day, shiftISODate(todayISO(), -6)),
      ),
    )
    .orderBy(desc(trainingCheckins.day))
    .limit(7);
  const latestCheckin = checkins[0];
  const insights = await getTrainingInsights(user.id);
  const decliningAnchors = insights.decliningAnchors;
  const status = buildTrainingPlanStatus({
    blockStartedOn: state.blockStartedOn,
    today: todayISO(),
    isDeload: state.isDeload,
    checkin: latestCheckin ?? null,
    decliningAnchors,
    recentCheckins: checkins,
  });

  return NextResponse.json({
    state,
    status,
    latestCheckin: latestCheckin ?? null,
    routines: insights.routines.map((r) => ({
      id: r.id,
      name: r.name,
      position: r.position,
      exercises: r.plan.map((p) => ({
        ...p,
        exerciseName: p.name,
        exercisePosition: p.position,
      })),
    })),
    volume: insights.volume,
    recommendations: insights.recommendations,
    nextRoutine: insights.nextRoutine,
  });
}

export async function PATCH(req: Request) {
  const user = await requireAppUser();
  await ensureState(user.id);
  const parsed = trainingPlanUpdate.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid training-plan update" },
      { status: 400 },
    );
  const body = parsed.data;
  const action = body.action;
  const today = todayISO();

  if (body.action === "checkin") {
    const [row] = await db
      .insert(trainingCheckins)
      .values({
        userId: user.id,
        day: today,
        sleepPoor: !!body.sleepPoor,
        appetiteLow: !!body.appetiteLow,
        jointPain: !!body.jointPain,
        notes: body.notes ? String(body.notes).slice(0, 1000) : null,
      })
      .onConflictDoUpdate({
        target: [trainingCheckins.userId, trainingCheckins.day],
        set: {
          sleepPoor: !!body.sleepPoor,
          appetiteLow: !!body.appetiteLow,
          jointPain: !!body.jointPain,
          notes: body.notes ? String(body.notes).slice(0, 1000) : null,
        },
      })
      .returning();
    return NextResponse.json(row);
  }

  if (action === "start_deload") {
    const [row] = await db
      .update(trainingPlanState)
      .set({ isDeload: true, deloadStartedOn: today, updatedAt: new Date() })
      .where(eq(trainingPlanState.userId, user.id))
      .returning();
    return NextResponse.json(row);
  }

  if (action === "finish_deload" || action === "start_new_block") {
    const [row] = await db
      .update(trainingPlanState)
      .set({
        blockStartedOn: today,
        isDeload: false,
        deloadStartedOn: null,
        updatedAt: new Date(),
      })
      .where(eq(trainingPlanState.userId, user.id))
      .returning();
    return NextResponse.json(row);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
