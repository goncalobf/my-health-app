import Link from "next/link";
import { desc, eq, ilike, gte, sql } from "drizzle-orm";
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

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = todayISO();
  const targets = await getTargets();

  const todayLogs = await db
    .select()
    .from(nutritionLogs)
    .where(eq(nutritionLogs.day, today));
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
    .orderBy(desc(sessions.startedAt))
    .limit(1);

  const [latestWeight] = await db
    .select()
    .from(bodyweightLogs)
    .orderBy(desc(bodyweightLogs.day))
    .limit(1);

  const dayOfWeek = dayOfWeekISO(today);
  let [scheduled] = await db.select({ id: routines.id, name: routines.name })
    .from(workoutSchedule)
    .innerJoin(routines, eq(routines.id, workoutSchedule.routineId))
    .where(eq(workoutSchedule.dayOfWeek, dayOfWeek));
  if (!scheduled && dayOfWeek <= 6) {
    const term = dayOfWeek % 3 === 1 ? "push" : dayOfWeek % 3 === 2 ? "pull" : "leg";
    [scheduled] = await db.select({ id: routines.id, name: routines.name })
      .from(routines).where(ilike(routines.name, `%${term}%`)).limit(1);
  }
  const [todayBurn] = await db.select().from(expenditureLogs).where(eq(expenditureLogs.day, today));
  const weekStartDay = shiftISODate(today, -6);
  const weekStart = startOfAppDay(weekStartDay);
  const [[training], [nutritionDays]] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(sessions).where(gte(sessions.finishedAt, weekStart)),
    db.select({ count: sql<number>`count(distinct ${nutritionLogs.day})::int` }).from(nutritionLogs).where(gte(nutritionLogs.day, weekStartDay)),
  ]);

  const hour = hourInAppTimeZone();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-muted text-sm">{formatDate(today)}</p>
          <h1 className="text-2xl font-bold">{greeting}</h1>
        </div>
        <Link
          href="/settings"
          className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-muted"
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

      <CoachDashboardCard />

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/workouts"
          className="card p-4 flex flex-col gap-2 active:scale-[0.98] transition"
        >
          <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
            <Dumbbell className="text-accent" size={20} />
          </div>
          <span className="font-semibold">Start workout</span>
          <span className="text-xs text-muted">Routines & sessions</span>
        </Link>
        <Link
          href="/nutrition"
          className="card p-4 flex flex-col gap-2 active:scale-[0.98] transition"
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
            <div>
              <p className="font-semibold">{lastSession.name}</p>
              <p className="text-xs text-muted">
                {formatDate(
                  new Date(lastSession.startedAt).toISOString().slice(0, 10)
                )}
                {!lastSession.finishedAt && (
                  <span className="text-accent"> · in progress</span>
                )}
              </p>
            </div>
            <ChevronRight className="text-muted" size={20} />
          </Link>
        </section>
      )}

      <section>
        <Link
          href="/progress"
          className="card p-4 flex items-center justify-between active:scale-[0.98] transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center">
              <Scale className="text-muted" size={20} />
            </div>
            <div>
              <p className="font-semibold">Bodyweight</p>
              <p className="text-xs text-muted">
                {latestWeight
                  ? `${latestWeight.weightKg} kg${targets.goalWeightKg ? ` → ${targets.goalWeightKg} kg goal` : ""} · ${formatDate(latestWeight.day)}`
                  : targets.currentWeightKg
                    ? `${targets.currentWeightKg} kg${targets.goalWeightKg ? ` → ${targets.goalWeightKg} kg goal` : ""} · profile`
                  : "No entries yet"}
              </p>
            </div>
          </div>
          <ChevronRight className="text-muted" size={20} />
        </Link>
      </section>
    </div>
  );
}
