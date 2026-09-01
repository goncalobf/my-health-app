import Link from "next/link";
import { and, desc, eq, ilike, gte, isNotNull, sql } from "drizzle-orm";
import { Dumbbell, Apple, Settings, ChevronRight, Scale, Users } from "lucide-react";
import { db } from "@/db";
import { nutritionLogs, sessions, bodyweightLogs, workoutSchedule, routines, expenditureLogs } from "@/db/schema";
import { getTargets } from "@/lib/server-data";
import {
  dayOfWeekISO,
  formatDate,
  hourInAppTimeZone,
  shiftISODate,
  startOfAppDay,
  todayISO,
} from "@/lib/utils";
import MacroSummary from "@/components/MacroSummary";
import DailyPlan from "@/components/DailyPlan";
import CoachDashboardCard from "@/components/CoachDashboardCard";
import NutritionPhaseCard from "@/components/NutritionPhaseCard";
import MotivationCard from "@/components/MotivationCard";
import { pickImage, pickLine } from "@/lib/motivation";
import { isSlipping, topMotivationFact } from "@/lib/motivation-facts";
import { getMotivationInput } from "@/lib/motivation-server";
import { requireAppUser } from "@/lib/app-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAppUser();
  const today = todayISO();
  const dayOfWeek = dayOfWeekISO(today);
  const weekStartDay = shiftISODate(today, -6);
  const weekStart = startOfAppDay(weekStartDay);
  const [
    targets,
    todayLogs,
    lastSessions,
    latestWeights,
    scheduledRoutines,
    todayBurns,
    trainingRows,
    nutritionDayRows,
    motivation,
  ] = await Promise.all([
    getTargets(user.id),
    db
      .select()
      .from(nutritionLogs)
      .where(
        and(eq(nutritionLogs.userId, user.id), eq(nutritionLogs.day, today))
      ),
    db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(desc(sessions.startedAt))
      .limit(1),
    db
      .select()
      .from(bodyweightLogs)
      .where(eq(bodyweightLogs.userId, user.id))
      .orderBy(desc(bodyweightLogs.day))
      .limit(1),
    db
      .select({ id: routines.id, name: routines.name })
      .from(workoutSchedule)
      .innerJoin(routines, eq(routines.id, workoutSchedule.routineId))
      .where(
        and(
          eq(workoutSchedule.userId, user.id),
          eq(workoutSchedule.dayOfWeek, dayOfWeek)
        )
      ),
    db
      .select()
      .from(expenditureLogs)
      .where(
        and(eq(expenditureLogs.userId, user.id), eq(expenditureLogs.day, today))
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(
        and(eq(sessions.userId, user.id), gte(sessions.finishedAt, weekStart))
      ),
    db
      .select({ count: sql<number>`count(distinct ${nutritionLogs.day})::int` })
      .from(nutritionLogs)
      .where(
        and(
          eq(nutritionLogs.userId, user.id),
          gte(nutritionLogs.day, weekStartDay)
        )
      ),
    getMotivationInput(user.id),
  ]);
  const lastSession = lastSessions[0];
  const latestWeight = latestWeights[0];
  let scheduled = scheduledRoutines[0];
  const todayBurn = todayBurns[0];
  const training = trainingRows[0];
  const nutritionDays = nutritionDayRows[0];
  const totals = todayLogs.reduce(
    (a, r) => ({
      calories: a.calories + r.calories,
      proteinG: a.proteinG + r.proteinG,
      carbsG: a.carbsG + r.carbsG,
      fatG: a.fatG + r.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  if (!scheduled && dayOfWeek <= 6) {
    const term = dayOfWeek % 3 === 1 ? "push" : dayOfWeek % 3 === 2 ? "pull" : "leg";
    [scheduled] = await db.select({ id: routines.id, name: routines.name })
      .from(routines).where(and(eq(routines.userId, user.id), ilike(routines.name, `%${term}%`))).limit(1);
  }

  let completedToday = false;
  if (scheduled) {
    const [doneToday] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, user.id),
          eq(sessions.routineId, scheduled.id),
          gte(sessions.startedAt, startOfAppDay(today)),
          isNotNull(sessions.finishedAt)
        )
      )
      .limit(1);
    completedToday = !!doneToday;
  }

  const slipping = isSlipping(motivation);
  const motivationFact = topMotivationFact(motivation);
  // Seeded per user per day: the poster holds still until tomorrow.
  const motivationSeed = `${today}:${user.id}`;

  const hour = hourInAppTimeZone();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.24em] text-accent">Fitlog / daily log</p>
          <h1 className="truncate font-display text-4xl leading-none tracking-[0.035em] min-[360px]:text-5xl">{greeting}</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-muted">{formatDate(today)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/friends"
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-border bg-surface-2 text-muted [border-radius:2px_11px_2px_2px]"
            aria-label="Friends"
          >
            <Users size={20} />
          </Link>
          <Link
            href="/settings"
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-border bg-surface-2 text-muted [border-radius:2px_11px_2px_2px]"
            aria-label="Settings"
          >
            <Settings size={20} />
          </Link>
        </div>
      </header>

      <MotivationCard
        image={pickImage(motivationSeed)}
        line={pickLine(slipping ? "slipping" : "dashboard", motivationSeed)}
        fact={motivationFact?.text ?? null}
        eyebrow={slipping ? "Get back in" : null}
        priority
      />

      <DailyPlan
        day={today}
        routine={scheduled ?? null}
        activeSessionId={lastSession && !lastSession.finishedAt ? lastSession.id : null}
        completedToday={completedToday}
        garminCalories={todayBurn?.totalCalories ?? null}
      />

      <NutritionPhaseCard />

      <CoachDashboardCard />

      <section className="grid grid-cols-2 gap-2 min-[360px]:gap-3">
        <Link
          href="/workouts"
          className="card min-w-0 overflow-hidden p-4 active:scale-[0.98] transition min-[360px]:p-5"
        >
          <div className="mb-7 flex items-center justify-between"><Dumbbell className="text-accent" size={20} /><span className="font-display text-xl text-muted/30">01</span></div>
          <span className="font-display text-2xl leading-none tracking-[0.04em]">Start workout</span>
          <span className="mt-2 block text-[10px] uppercase tracking-[0.1em] text-muted">Routines / sessions</span>
        </Link>
        <Link
          href="/nutrition"
          className="card min-w-0 overflow-hidden p-4 active:scale-[0.98] transition min-[360px]:p-5"
        >
          <div className="mb-7 flex items-center justify-between"><Apple className="text-warn" size={20} /><span className="font-display text-xl text-muted/30">02</span></div>
          <span className="font-display text-2xl leading-none tracking-[0.04em]">Log food</span>
          <span className="mt-2 block text-[10px] uppercase tracking-[0.1em] text-muted">Search / scan</span>
        </Link>
      </section>

      <section>
        <h2 className="section-title">Today / nutrition</h2>
        <MacroSummary totals={totals} targets={targets} />
      </section>

      <section>
        <h2 className="section-title">Last 7 days</h2>
        <div className="card grid grid-cols-2 gap-0 overflow-hidden p-0 text-center">
          <div className="border-r border-border p-5"><p className="data-number text-4xl text-accent">{training?.count ?? 0}<span className="ml-1 text-base text-muted">/ 6</span></p><p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">Workouts</p></div>
          <div className="p-5"><p className="data-number text-4xl text-warn">{nutritionDays?.count ?? 0}<span className="ml-1 text-base text-muted">/ 7</span></p><p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">Nutrition days</p></div>
        </div>
      </section>

      {lastSession && (
        <section>
          <h2 className="section-title">Last workout</h2>
          <Link
            href={
              lastSession.finishedAt
                ? `/workouts/session/${lastSession.id}/summary`
                : `/workouts/session/${lastSession.id}`
            }
            className="card p-4 flex items-center justify-between active:scale-[0.98] transition"
          >
            <div className="min-w-0 flex-1">
              <p className="break-words font-display text-xl tracking-[0.04em]">{lastSession.name}</p>
              <p className="text-xs text-muted">
                {formatDate(
                  new Date(lastSession.startedAt).toISOString().slice(0, 10)
                )}
                {!lastSession.finishedAt && (
                  <span className="text-accent"> · in progress</span>
                )}
              </p>
            </div>
            <ChevronRight className="shrink-0 text-muted" size={20} />
          </Link>
        </section>
      )}

      <section>
        <Link
          href="/progress"
          className="card p-4 flex items-center justify-between active:scale-[0.98] transition"
        >
          <div className="min-w-0 flex flex-1 items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-surface-2 flex items-center justify-center">
              <Scale className="text-muted" size={20} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold">Bodyweight</p>
              <p className="break-words text-xs text-muted">
                {latestWeight
                  ? `${latestWeight.weightKg} kg${targets.goalWeightKg ? ` → ${targets.goalWeightKg} kg goal` : ""} · ${formatDate(latestWeight.day)}`
                  : targets.currentWeightKg
                    ? `${targets.currentWeightKg} kg${targets.goalWeightKg ? ` → ${targets.goalWeightKg} kg goal` : ""} · profile`
                  : "No entries yet"}
              </p>
            </div>
          </div>
          <ChevronRight className="shrink-0 text-muted" size={20} />
        </Link>
      </section>
    </div>
  );
}
