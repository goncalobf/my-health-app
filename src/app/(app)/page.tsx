import Link from "next/link";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { Dumbbell, Apple, Settings, ChevronRight, Scale, Users, Move, ChartNoAxesCombined } from "lucide-react";
import { db } from "@/db";
import { nutritionLogs, sessions, bodyweightLogs, expenditureLogs, friendships } from "@/db/schema";
import { getTargets } from "@/lib/server-data";
import {
  dateISOInTimeZone,
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
import BrandMark from "@/components/BrandMark";
import { requireAppUser } from "@/lib/app-user";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAppUser();
  const today = todayISO();
  const weekStartDay = shiftISODate(today, -6);
  const weekStart = startOfAppDay(weekStartDay);
  const [
    targets,
    todayLogs,
    lastSessions,
    latestWeights,
    todayBurns,
    trainingRows,
    nutritionDayRows,
    pendingFriendRequests,
  ] = await Promise.all([
    getTargets(user.id),
    db
      .select()
      .from(nutritionLogs)
      .where(
        and(eq(nutritionLogs.userId, user.id), eq(nutritionLogs.day, today))
      ),
    db.select({ id: sessions.id, name: sessions.name, startedAt: sessions.startedAt })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), isNotNull(sessions.finishedAt)))
      .orderBy(desc(sessions.startedAt), desc(sessions.id))
      .limit(1),
    db
      .select()
      .from(bodyweightLogs)
      .where(eq(bodyweightLogs.userId, user.id))
      .orderBy(desc(bodyweightLogs.day))
      .limit(1),
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
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(friendships)
      .where(and(eq(friendships.recipientId, user.id), eq(friendships.status, "pending"))),
  ]);
  const hasPendingFriendRequests = (pendingFriendRequests[0]?.count ?? 0) > 0;
  const lastSession = lastSessions[0];
  const latestWeight = latestWeights[0];
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

  const hour = hourInAppTimeZone();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const firstName = user.name?.trim().split(/\s+/)[0];
  const quickActions = [
    { href: "/workouts", title: "Train", icon: Dumbbell },
    { href: "/nutrition", title: "Log food", icon: Apple },
    { href: "/progress", title: "Progress", icon: ChartNoAxesCombined },
  ];

  return (
    <div className="space-y-6 min-[880px]:space-y-8">
      <header>
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="min-[880px]:hidden"><BrandMark /></span>
          <time dateTime={today} className="hidden text-sm font-bold text-muted min-[880px]:block">{formatDate(today)}</time>
          <div className="flex items-center gap-2">
            <Link href="/friends" className="icon-button relative" aria-label={hasPendingFriendRequests ? "Friends (pending request)" : "Friends"}>
              <Users size={18} aria-hidden="true" />
              {hasPendingFriendRequests && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" aria-hidden="true" />}
            </Link>
            <Link href="/settings" className="icon-button" aria-label="Settings"><Settings size={18} aria-hidden="true" /></Link>
          </div>
        </div>
        <time dateTime={today} className="mb-1 block text-sm font-bold text-accent min-[880px]:hidden">{formatDate(today)}</time>
        <h1 className="break-words font-display text-[clamp(2rem,8.4vw,3rem)] leading-[1.07] min-[880px]:text-[3.5rem]">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      <section className="grid grid-cols-3 gap-2 min-[520px]:gap-3" aria-label="Quick actions">
        {quickActions.map(({ href, title, icon: Icon }) => (
          <Link key={href} href={href} className="card surface-link flex min-w-0 flex-col items-start gap-2 p-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:gap-3">
            <span className="icon-frame h-9 w-9">
              <Icon size={17} aria-hidden="true" />
            </span>
            <span className="min-w-0 text-xs font-extrabold min-[375px]:text-sm">{title}</span>
            <ChevronRight className="ml-auto hidden text-muted min-[520px]:block" size={16} aria-hidden="true" />
          </Link>
        ))}
      </section>

      <div className="grid items-start gap-5 min-[1040px]:grid-cols-[1.15fr_1fr]">
        <div className="space-y-3">
          <DailyPlan day={today} garminCalories={todayBurn?.totalCalories ?? null} />
          <Link href="/workouts/mobility" className="card surface-link flex items-center gap-3 p-4">
            <span className="icon-frame"><Move size={18} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1 text-sm font-extrabold">Mobility &amp; flexibility</span>
            <ChevronRight className="shrink-0 text-muted" size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="space-y-4">
          <section aria-labelledby="today-nutrition">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="today-nutrition" className="section-title mb-0">Today’s nutrition</h2>
              <Link href="/nutrition" className="text-xs font-extrabold text-accent hover:underline">Open food log</Link>
            </div>
            <MacroSummary totals={totals} targets={targets} />
          </section>
          <NutritionPhaseCard />
          <CoachDashboardCard />
        </div>
      </div>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="section-title">Last 7 days</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/workouts/history" className="card surface-link p-4">
            <Dumbbell size={18} className="mb-2 text-accent" aria-hidden="true" />
            <p className="data-number text-3xl">{training?.count ?? 0}</p>
            <p className="mt-1 text-xs font-semibold text-muted">Gym workouts</p>
          </Link>
          <Link href="/nutrition" className="card surface-link p-4">
            <Apple size={18} className="mb-2 text-accent" aria-hidden="true" />
            <p className="data-number text-3xl">{nutritionDays?.count ?? 0}<span className="ml-1 text-sm text-muted">/ 7</span></p>
            <p className="mt-1 text-xs font-semibold text-muted">Days with food logs</p>
          </Link>
        </div>
      </section>

      <div className="grid gap-3 min-[1040px]:grid-cols-2">
        {lastSession && (
          <Link
            href={`/workouts/session/${lastSession.id}/summary`}
            className="card surface-link flex items-center gap-3 p-4"
          >
            <span className="icon-frame"><Dumbbell size={18} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <p className="label">Last gym workout</p>
              <p className="mt-1 break-words font-bold">{lastSession.name}</p>
              <p className="text-xs text-muted">{formatDate(dateISOInTimeZone(lastSession.startedAt))}</p>
            </div>
            <ChevronRight className="shrink-0 text-muted" size={18} aria-hidden="true" />
          </Link>
        )}
        <Link href="/progress?view=body" className="card surface-link flex items-center gap-3 p-4">
          <span className="icon-frame"><Scale size={18} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="label">Body weight</p>
            <p className="mt-1 break-words font-bold">
              {latestWeight ? `${latestWeight.weightKg} kg` : targets.currentWeightKg ? `${targets.currentWeightKg} kg` : "No entries yet"}
            </p>
            {latestWeight && <p className="text-xs text-muted">{formatDate(latestWeight.day)}</p>}
          </div>
          <ChevronRight className="shrink-0 text-muted" size={18} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
