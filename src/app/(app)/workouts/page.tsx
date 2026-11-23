"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Play,
  Dumbbell,
  History,
  ListChecks,
  Zap,
  X,
  TrendingUp,
  Footprints,
  CalendarPlus,
  Move,
  ChevronRight,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import WorkoutDayCard from "@/components/WorkoutDayCard";
import PageHeader from "@/components/PageHeader";
import ActivityTypePicker from "@/components/ActivityTypePicker";
import LogPastActivityModal from "@/components/LogPastActivityModal";

interface RoutineRow {
  id: number;
  name: string;
  exerciseCount: number;
}
export default function WorkoutsPage() {
  const router = useRouter();
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [showCardio, setShowCardio] = useState(false);
  const [showLogPast, setShowLogPast] = useState(false);
  const [creating, setCreating] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [savingRoutine, setSavingRoutine] = useState(false);

  async function load() {
    setRoutines(await apiGet<RoutineRow[]>("/api/routines"));
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => {
      setError("Could not load workouts");
      setLoading(false);
    });
  }, []);

  async function newRoutine(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!routineName.trim() || savingRoutine) return;
    setError("");
    setSavingRoutine(true);
    try {
      const created = await apiPost<{ id: number }>("/api/routines", { name: routineName.trim() });
      router.push(`/workouts/routines/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create routine.");
      setSavingRoutine(false);
    }
  }

  async function startSession(routineId?: number) {
    setStarting(true);
    try {
      const created = await apiPost<{ id: number }>("/api/sessions", {
        routineId,
      });
      router.push(`/workouts/session/${created.id}?hype=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start workout");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Workouts"
        description="Plan today, start an activity, or revisit your training."
        action={
          <button
            onClick={() => { setCreating((value) => !value); setError(""); }}
            className="icon-button"
            aria-label={creating ? "Close new routine" : "New routine"}
            aria-expanded={creating}
          >
            {creating ? <X size={21} /> : <Plus size={21} />}
          </button>
        }
      />
      {error && <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {creating && (
        <form onSubmit={newRoutine} className="card mb-5 p-4">
          <label htmlFor="routine-name" className="label">Routine name</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              id="routine-name"
              className="input min-w-[8rem] flex-1"
              maxLength={150}
              value={routineName}
              onChange={(event) => setRoutineName(event.target.value)}
              placeholder="e.g. Lower body"
              autoFocus
              required
            />
            <button className="btn-primary" disabled={savingRoutine || !routineName.trim()}>
              {savingRoutine ? "Creating…" : "Create routine"}
            </button>
          </div>
        </form>
      )}

      <div className="grid items-start gap-5 min-[1060px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <WorkoutDayCard />
          <section aria-labelledby="activities-heading">
            <h2 id="activities-heading" className="section-title">Start or log an activity</h2>
            <div className="grid grid-cols-2 gap-2 min-[375px]:gap-3">
              <button onClick={() => startSession()} disabled={starting} className="card surface-link flex min-w-0 flex-col items-start gap-2 p-3 text-left text-sm font-bold disabled:opacity-50">
                <span className="icon-frame"><Zap size={18} aria-hidden="true" /></span>
                Quick workout
              </button>
              <button onClick={() => setShowCardio(true)} className="card surface-link flex min-w-0 flex-col items-start gap-2 p-3 text-left text-sm font-bold">
                <span className="icon-frame"><Footprints size={18} aria-hidden="true" /></span>
                Cardio
              </button>
              <Link href="/workouts/mobility" className="card surface-link flex min-w-0 flex-col items-start gap-2 p-3 text-sm font-bold">
                <span className="icon-frame"><Move size={18} aria-hidden="true" /></span>
                Mobility &amp; flexibility
              </Link>
              <button onClick={() => setShowLogPast(true)} className="card surface-link flex min-w-0 flex-col items-start gap-2 p-3 text-left text-sm font-bold">
                <span className="icon-frame"><CalendarPlus size={18} aria-hidden="true" /></span>
                Log past activity
              </button>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section aria-labelledby="routines-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="routines-heading" className="section-title mb-0">Your routines</h2>
              <Link href="/workouts/exercises" className="inline-flex min-h-10 items-center gap-1.5 text-xs font-extrabold text-accent hover:underline">
                <ListChecks size={15} aria-hidden="true" /> Exercise library
              </Link>
            </div>
            {loading ? (
              <p role="status" className="card p-4 text-sm text-muted">Loading routines…</p>
            ) : routines.length === 0 ? (
              <div className="card space-y-3 p-5">
                <p className="text-sm text-muted">Create a routine to save a group of exercises for next time.</p>
                <button onClick={() => setCreating(true)} className="btn-ghost"><Plus size={17} /> New routine</button>
              </div>
            ) : (
              <ul className="space-y-2">
                {routines.map((routine) => (
                  <li key={routine.id} className="card flex min-w-0 items-center gap-2.5 p-3 min-[375px]:gap-3">
                    <span className="icon-frame"><Dumbbell size={17} aria-hidden="true" /></span>
                    <Link href={`/workouts/routines/${routine.id}`} className="min-w-0 flex-1 py-1 hover:text-accent">
                      <p className="break-words text-sm font-extrabold">{routine.name}</p>
                      <p className="mt-0.5 text-xs text-muted">{routine.exerciseCount} {routine.exerciseCount === 1 ? "exercise" : "exercises"}</p>
                    </Link>
                    <button onClick={() => startSession(routine.id)} disabled={starting || routine.exerciseCount === 0} className="btn-ghost shrink-0 px-2.5">
                      <Play size={16} aria-hidden="true" /> Start
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-2">
            <Link href="/workouts/plan" className="card surface-link flex items-center gap-3 p-4">
              <span className="icon-frame"><TrendingUp size={18} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold">Plan &amp; progression</p>
                <p className="mt-0.5 text-xs text-muted">Training volume, targets and recovery</p>
              </div>
              <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-muted" />
            </Link>
            <Link href="/workouts/history" className="card surface-link flex items-center gap-3 p-4">
              <span className="icon-frame"><History size={18} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1 text-sm font-extrabold">Workout history</span>
              <ChevronRight size={17} aria-hidden="true" className="shrink-0 text-muted" />
            </Link>
          </div>
        </div>
      </div>

      {showCardio && <ActivityTypePicker onClose={() => setShowCardio(false)} />}
      {showLogPast && <LogPastActivityModal onClose={() => setShowLogPast(false)} />}
    </div>
  );
}
