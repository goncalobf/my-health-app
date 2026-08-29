import Link from "next/link";
import { and, desc, eq, ilike, gte, sql } from "drizzle-orm";
import { Dumbbell, Apple, Settings, ChevronRight, Scale } from "lucide-react";
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
import { requireAppUser } from "@/lib/app-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAppUser();
  const today = todayISO();
  const targets = await getTargets(user.id);

  const todayLogs = await db
    .select()
    .from(nutritionLogs)
    .where(and(eq(nutritionLogs.userId, user.id), eq(nutritionLogs.day, today)));
  const totals = todayLogs.reduce(
    (a, r) => ({
      calories: a.calories + r.calories,
      proteinG: a.proteinG + r.proteinG,
      carbsG: a.carbsG + r.carbsG,
      fatG: a.fatG + r.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  const [lastSession] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  const [latestWeight] = await db
    .select()
    .from(bodyweightLogs)
    .where(eq(bodyweightLogs.userId, user.id))
    .orderBy(desc(bodyweightLogs.day))
    .limit(1);

  const dayOfWeek = dayOfWeekISO(today);
  let [scheduled] = await db.select({ id: routines.id, name: routines.name })
    .from(workoutSchedule)
    .innerJoin(routines, eq(routines.id, workoutSchedule.routineId))
    .where(and(eq(workoutSchedule.userId, user.id), eq(workoutSchedule.dayOfWeek, dayOfWeek)));
  if (!scheduled && dayOfWeek <= 6) {
    const term = dayOfWeek % 3 === 1 ? "push" : dayOfWeek % 3 === 2 ? "pull" : "leg";
    [scheduled] = await db.select({ id: routines.id, name: routines.name })
      .from(routines).where(and(eq(routines.userId, user.id), ilike(routines.name, `%${term}%`))).limit(1);
  }
  const [todayBurn] = await db.select().from(expenditureLogs).where(and(eq(expenditureLogs.userId, user.id), eq(expenditureLogs.day, today)));
  const weekStartDay = shiftISODate(today, -6);
  const weekStart = startOfAppDay(weekStartDay);
  const [[training], [nutritionDays]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(sessions).where(and(eq(sessions.userId, user.id), gte(sessions.finishedAt, weekStart))),
    db.select({ count: sql<number>`count(distinct ${nutritionLogs.day})::int` }).from(nutritionLogs).where(and(eq(nutritionLogs.userId, user.id), gte(nutritionLogs.day, weekStartDay))),
  ]);

  const hour = hourInAppTimeZone();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-muted text-sm">{formatDate(today)}</p>
          <h1 className="truncate text-xl font-bold min-[360px]:text-2xl">{greeting}</h1>
        </div>
        <Link
          href="/settings"
          className="w-10 h-10 shrink-0 rounded-full bg-surface-2 border border-border flex items-center justify-center text-muted"
        >
          <Settings size={20} />
        </Link>
      </header>

      <DailyPlan
        day={today}
        routine={scheduled ?? null}
        activeSessionId={lastSession && !lastSession.finishedAt ? lastSession.id : null}
        garminCalories={todayBurn?.totalCalories ?? null}
      />

      <NutritionPhaseCard />

      <CoachDashboardCard />

      <section className="grid grid-cols-2 gap-2 min-[360px]:gap-3">
        <Link
          href="/workouts"
          className="card min-w-0 p-3 min-[360px]:p-4 flex flex-col gap-2 active:scale-[0.98] transition"
        >
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
            <Dumbbell className="text-accent" size={20} />
          </div>
          <span className="font-semibold">Start workout</span>
          <span className="text-xs text-muted">Routines & sessions</span>
        </Link>
        <Link
          href="/nutrition"
          className="card min-w-0 p-3 min-[360px]:p-4 flex flex-col gap-2 active:scale-[0.98] transition"
        >
          <div className="w-10 h-10 rounded-xl bg-warn/15 flex items-center justify-center">
            <Apple className="text-warn" size={20} />
          </div>
          <span className="font-semibold">Log food</span>
          <span className="text-xs text-muted">Search or scan</span>
        </Link>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted mb-2">Today</h2>
        <MacroSummary totals={totals} targets={targets} />
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted mb-2">Last 7 days</h2>
        <div className="card p-4 grid grid-cols-2 gap-4 text-center">
          <div><p className="text-2xl font-bold text-accent">{training?.count ?? 0}<span className="text-sm text-muted font-normal"> / 6</span></p><p className="text-xs text-muted">Workouts</p></div>
          <div><p className="text-2xl font-bold text-warn">{nutritionDays?.count ?? 0}<span className="text-sm text-muted font-normal"> / 7</span></p><p className="text-xs text-muted">Nutrition days</p></div>
        </div>
      </section>

      {lastSession && (
        <section>
          <h2 className="text-sm font-semibold text-muted mb-2">
            Last workout
          </h2>
          <Link
            href={
              lastSession.finishedAt
                ? "/workouts"
                : `/workouts/session/${lastSession.id}`
            }
            className="card p-4 flex items-center justify-between active:scale-[0.98] transition"
          >
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold">{lastSession.name}</p>
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
