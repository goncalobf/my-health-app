"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Play, Dumbbell, History, ListChecks, Zap, TrendingUp, Footprints, CalendarPlus } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import ActivityTypePicker from "@/components/ActivityTypePicker";
import LogPastActivityModal from "@/components/LogPastActivityModal";

interface RoutineRow {
  id: number;
  name: string;
  exerciseCount: number;
}
interface SessionRow {
  id: number;
  name: string;
  startedAt: string;
  finishedAt: string | null;
}

export default function WorkoutsPage() {
  const router = useRouter();
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [active, setActive] = useState<SessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showCardio, setShowCardio] = useState(false);
  const [showLogPast, setShowLogPast] = useState(false);

  async function load() {
    const [r, s] = await Promise.all([
      apiGet<RoutineRow[]>("/api/routines"),
      apiGet<SessionRow[]>("/api/sessions"),
    ]);
    setRoutines(r);
    setActive(s.find((x) => !x.finishedAt) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function newRoutine() {
    const name = window.prompt("Routine name (e.g. Push A)");
    if (!name?.trim()) return;
    const created = await apiPost<{ id: number }>("/api/routines", {
      name: name.trim(),
    });
    router.push(`/workouts/routines/${created.id}`);
  }

  async function startSession(routineId?: number) {
    setStarting(true);
    try {
      const created = await apiPost<{ id: number }>("/api/sessions", {
        routineId,
      });
      router.push(`/workouts/session/${created.id}?hype=1`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Workouts"
        action={
          <button
            onClick={newRoutine}
            className="flex h-11 w-11 items-center justify-center bg-accent text-bg [border-radius:2px_11px_2px_2px]"
            aria-label="New routine"
          >
            <Plus size={22} />
          </button>
        }
      />

      {active && (
        <Link
          href={`/workouts/session/${active.id}`}
          className="card mb-5 flex items-center justify-between border-accent/40 bg-accent/10 p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              Live session
            </p>
            <p className="mt-1 break-words font-display text-2xl tracking-[0.04em]">{active.name}</p>
          </div>
          <span className="btn-primary shrink-0 px-3 py-2 min-[360px]:px-4">Resume</span>
        </Link>
      )}

      <div className="mb-5 grid grid-cols-2 gap-2 min-[360px]:gap-3">
        <button
          onClick={() => startSession(undefined)}
          disabled={starting}
          className="btn-ghost min-w-0 px-2 min-[360px]:px-4"
        >
          <Zap size={18} /> Quick workout
        </button>
        <button
          onClick={() => setShowCardio(true)}
          className="btn-ghost min-w-0 px-2 min-[360px]:px-4"
        >
          <Footprints size={18} /> Cardio
        </button>
        <button
          onClick={() => setShowLogPast(true)}
          className="btn-ghost min-w-0 px-2 min-[360px]:px-4"
        >
          <CalendarPlus size={18} /> Log past activity
        </button>
        <Link href="/workouts/exercises" className="btn-ghost min-w-0 px-2 min-[360px]:px-4">
          <ListChecks size={18} /> Exercises
        </Link>
      </div>

      {showCardio && <ActivityTypePicker onClose={() => setShowCardio(false)} />}
      {showLogPast && <LogPastActivityModal onClose={() => setShowLogPast(false)} />}

      <Link href="/workouts/plan" className="card mb-6 flex items-center gap-3 p-4 active:scale-[0.98] transition">
        <div className="icon-frame"><TrendingUp size={20} /></div>
        <div className="min-w-0 flex-1"><p className="font-display text-xl tracking-[0.04em]">Plan & progression</p><p className="text-xs text-muted">RIR / double progression / deloads</p></div>
      </Link>

      <h2 className="section-title">Your routines</h2>
      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : routines.length === 0 ? (
        <div className="card p-6 flex flex-col items-center text-center gap-3">
          <Dumbbell className="text-muted" size={32} />
          <p className="text-muted text-sm">
            No routines yet. Create one to plan your training.
          </p>
          <button onClick={newRoutine} className="btn-primary">
            <Plus size={18} /> New routine
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {routines.map((r, index) => (
            <div key={r.id} className="card flex items-center gap-3 overflow-hidden p-3 min-[360px]:p-4">
              <span className="data-number w-8 shrink-0 text-2xl text-muted/35">{String(index + 1).padStart(2, "0")}</span>
              <Link href={`/workouts/routines/${r.id}`} className="min-w-0 flex-1 border-l border-border pl-3">
                <p className="break-words font-display text-2xl leading-none tracking-[0.04em]">{r.name}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-muted">
                  {r.exerciseCount} exercise
                  {r.exerciseCount === 1 ? "" : "s"}
                </p>
              </Link>
              <button
                onClick={() => startSession(r.id)}
                disabled={starting || r.exerciseCount === 0}
                className="btn-primary min-h-10 shrink-0 px-3 py-2 min-[360px]:px-4"
              >
                <Play size={18} /> Start
              </button>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/workouts/history"
        className="mt-5 card p-4 flex items-center gap-3 active:scale-[0.98] transition"
      >
        <History className="text-muted" size={20} />
        <span className="font-semibold flex-1">Workout history</span>
      </Link>
    </div>
  );
}
