"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, BarChart3, Clock, Dumbbell, Home, TrendingUp } from "lucide-react";
import { apiGet } from "@/lib/api";
import { est1RM, formatDuration, round } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import WorkoutCoach from "@/components/WorkoutCoach";
import ExerciseImage from "@/components/ExerciseImage";
import { getProgressionRecommendation } from "@/lib/progressive-overload";

interface SetRow { exerciseId: number; exerciseName: string; exerciseImageUrl: string | null; muscleGroup: string | null; weightKg: number; reps: number; rir: number | null; completedAt: string | null; isWarmup: boolean; }
interface Plan { exerciseId: number; name: string; imageUrl: string | null; muscleGroup: string | null; targetSets: number; minReps: number; maxReps: number; weightIncrementKg: number; targetRirMin: number | null; targetRirMax: number | null; deloadMode: boolean; }
interface Data {
  session: { name: string; startedAt: string; finishedAt: string | null };
  plan: Plan[];
  loggedSets: SetRow[];
  lastSets: Record<number, { weightKg: number; reps: number; rir?: number | null }[]>;
}

export default function WorkoutSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => { apiGet<Data>(`/api/sessions/${id}`).then(setData); }, [id]);

  const summary = useMemo(() => {
    if (!data) return null;
    const sets = data.loggedSets.filter((s) => s.completedAt && !s.isWarmup);
    const volume = sets.reduce((n, s) => n + s.weightKg * s.reps, 0);
    const duration = data.session.finishedAt
      ? Math.max(0, Math.round((new Date(data.session.finishedAt).getTime() - new Date(data.session.startedAt).getTime()) / 1000))
      : 0;
    const prs = data.plan.filter((p) => {
      const current = sets.filter((s) => s.exerciseId === p.exerciseId);
      const previous = data.lastSets[p.exerciseId] ?? [];
      return Math.max(0, ...current.map((s) => est1RM(s.weightKg, s.reps))) > Math.max(0, ...previous.map((s) => est1RM(s.weightKg, s.reps)));
    });
    const previousVolume = data.plan.reduce((total, p) => total + (data.lastSets[p.exerciseId] ?? []).reduce((n, s) => n + s.weightKg * s.reps, 0), 0);
    const volumeChangePct = previousVolume > 0 ? Math.round(((volume - previousVolume) / previousVolume) * 100) : null;
    const muscles = [...sets.reduce((map, s) => map.set(s.muscleGroup ?? "Other", (map.get(s.muscleGroup ?? "Other") ?? 0) + 1), new Map<string, number>())];
    const loggedRir = sets.filter((set) => set.rir != null);
    const averageRir = loggedRir.length
      ? round(loggedRir.reduce((total, set) => total + set.rir!, 0) / loggedRir.length, 1)
      : null;
    return { sets, volume, duration, prs, volumeChangePct, muscles, averageRir };
  }, [data]);

  if (!data || !summary) return <p className="text-muted text-sm">Building summary…</p>;

  return (
    <div>
      <PageHeader title="Workout complete" back="/workouts/history" />
      <div className="text-center mb-5">
        <div className="w-14 h-14 rounded-full bg-accent/15 text-accent flex items-center justify-center mx-auto mb-2"><Award size={28} /></div>
        <h1 className="break-words text-2xl font-bold">{data.session.name}</h1>
        <p className="text-sm text-muted">Strong work. Your next targets are ready.</p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-5 min-[400px]:grid-cols-4 min-[360px]:gap-2">
        <Stat icon={<Clock size={17} />} value={formatDuration(summary.duration)} label="Duration" />
        <Stat icon={<Dumbbell size={17} />} value={String(summary.sets.length)} label="Sets" />
        <Stat icon={<BarChart3 size={17} />} value={`${round(summary.volume, 0)}kg`} label="Volume" />
        <Stat icon={<TrendingUp size={17} />} value={summary.averageRir == null ? "—" : String(summary.averageRir)} label="Avg RIR" />
      </div>
      <div className="card p-4 mb-4">
        <p className="text-xs text-muted uppercase tracking-wide">Compared with previous performance</p>
        <p className="font-semibold mt-1">{summary.volumeChangePct == null ? "Your first volume baseline is saved." : `${summary.volumeChangePct >= 0 ? "+" : ""}${summary.volumeChangePct}% training volume`}</p>
        <div className="flex flex-wrap gap-2 mt-3">{summary.muscles.map(([name, sets]) => <span key={name} className="px-2.5 py-1 rounded-full bg-surface-2 text-xs text-muted">{name} · {sets} sets</span>)}</div>
      </div>

      {summary.prs.length > 0 && (
        <div className="card p-4 mb-4 border-accent/40 bg-accent/10">
          <p className="font-semibold text-accent flex items-center gap-2"><Award size={18} /> {summary.prs.length} new personal record{summary.prs.length === 1 ? "" : "s"}</p>
          <p className="text-sm text-muted mt-1">{summary.prs.map((p) => p.name).join(" · ")}</p>
        </div>
      )}

      <h2 className="text-sm font-semibold text-muted mb-2">Exercise recap & next target</h2>
      <div className="flex flex-col gap-3">
        {(data.plan.length ? data.plan : [...new Map(summary.sets.map((s) => [s.exerciseId, { exerciseId: s.exerciseId, name: s.exerciseName, imageUrl: s.exerciseImageUrl, muscleGroup: s.muscleGroup, targetSets: 1, minReps: 0, maxReps: 0, weightIncrementKg: 2.5, targetRirMin: null, targetRirMax: null, deloadMode: false } satisfies Plan])).values()]).map((p) => {
          const sets = summary.sets.filter((s) => s.exerciseId === p.exerciseId);
          if (!sets.length) return null;
          const planned = data.plan.length > 0;
          const recommendation = planned && !p.deloadMode
            ? getProgressionRecommendation(p, [
                sets.map((set) => ({ weightKg: set.weightKg, reps: set.reps, rir: set.rir })),
                ...(data.lastSets[p.exerciseId]?.length ? [data.lastSets[p.exerciseId]] : []),
              ])
            : null;
          return (
            <div key={p.exerciseId} className="card p-4">
              <div className="flex items-start gap-3">
                <ExerciseImage name={p.name} imageUrl={p.imageUrl} className="h-14 w-14" />
                <div className="min-w-0 flex-1"><p className="font-semibold">{p.name}</p><p className="text-xs text-muted">{sets.map((s) => `${s.weightKg}×${s.reps}${s.rir == null ? "" : ` @${s.rir}RIR`}`).join(" · ")}</p></div>
                <TrendingUp size={19} className={`shrink-0 ${recommendation?.action === "increase" ? "text-accent" : recommendation?.action === "reduce" ? "text-warn" : "text-muted"}`} />
              </div>
              <p className={`text-sm mt-2 ${recommendation?.action === "increase" ? "text-accent" : recommendation?.action === "reduce" ? "text-warn" : "text-muted"}`}>
                {p.deloadMode ? "Deload work saved. Normal progression resumes after you finish the deload week." : recommendation ? `Next time: ${recommendation.message}` : "Baseline saved."}
              </p>
              {recommendation && <p className="mt-1 text-[11px] leading-relaxed text-muted">Why: {recommendation.reason}</p>}
            </div>
          );
        })}
      </div>

      <WorkoutCoach sessionId={Number(id)} />
      <Link href="/" className="btn-primary w-full mt-5"><Home size={18} /> Back to dashboard</Link>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return <div className="card p-3 text-center"><span className="text-muted flex justify-center mb-1">{icon}</span><p className="font-bold tabular-nums truncate">{value}</p><p className="text-[11px] text-muted">{label}</p></div>;
}
