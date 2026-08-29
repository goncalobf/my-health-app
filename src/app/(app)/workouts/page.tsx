"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Play, Dumbbell, History, ListChecks, Zap } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

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
      router.push(`/workouts/session/${created.id}`);
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
            className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center"
            aria-label="New routine"
          >
            <Plus size={22} />
          </button>
        }
      />

      {active && (
        <Link
          href={`/workouts/session/${active.id}`}
          className="card p-4 mb-4 flex items-center justify-between border-accent/40 bg-accent/10"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs text-accent font-semibold uppercase tracking-wide">
              In progress
            </p>
            <p className="break-words font-semibold">{active.name}</p>
          </div>
          <span className="btn-primary shrink-0 px-3 py-2 min-[360px]:px-4">Resume</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2 min-[360px]:gap-3 mb-5">
        <button
          onClick={() => startSession(undefined)}
          disabled={starting}
          className="btn-ghost min-w-0 px-2 text-sm min-[360px]:px-4"
        >
          <Zap size={18} /> Quick workout
        </button>
        <Link href="/workouts/exercises" className="btn-ghost min-w-0 px-2 text-sm min-[360px]:px-4">
          <ListChecks size={18} /> Exercises
        </Link>
      </div>

      <h2 className="text-sm font-semibold text-muted mb-2">Your routines</h2>
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
          {routines.map((r) => (
            <div key={r.id} className="card p-4 flex items-center gap-3">
              <Link href={`/workouts/routines/${r.id}`} className="min-w-0 flex-1">
                <p className="break-words font-semibold">{r.name}</p>
                <p className="text-xs text-muted">
                  {r.exerciseCount} exercise
                  {r.exerciseCount === 1 ? "" : "s"}
                </p>
              </Link>
              <button
                onClick={() => startSession(r.id)}
                disabled={starting || r.exerciseCount === 0}
                className="btn-primary shrink-0 px-3 py-2.5 min-[360px]:px-4"
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
