"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { ChevronDown, Play, Sparkles } from "lucide-react";
import LogPastActivityModal from "./LogPastActivityModal";
import { JIU_JITSU } from "@/lib/jiu-jitsu";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { formatDate, shiftISODate } from "@/lib/utils";
import type { TrainingSuggestion, WorkoutDay } from "@/lib/workout-day";

function selectionValue(plan: WorkoutDay) {
  if (plan.choice) return plan.choice.routineId?.toString() ?? "rest";
  return plan.defaultRoutineId?.toString() ?? "";
}

export default function WorkoutDayCard() {
  const router = useRouter();
  const fieldId = useId();
  const [plan, setPlan] = useState<WorkoutDay | null>(null);
  const [selection, setSelection] = useState("");
  const [jiuJitsu, setJiuJitsu] = useState(false);
  const [loggingJiuJitsu, setLoggingJiuJitsu] = useState(false);
  const [suggestion, setSuggestion] = useState<TrainingSuggestion | null>(null);
  const [pending, setPending] = useState<"save" | "coach" | "start" | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const next = await apiGet<WorkoutDay>("/api/workout-day");
      setPlan(next);
      setSelection(selectionValue(next));
      setJiuJitsu(next.choice?.jiuJitsu ?? false);
    } catch {
      setError("Could not load today’s training.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveChoice() {
    if (!plan || !selection) return;
    setPending("save");
    setError("");
    try {
      const next = await apiPut<WorkoutDay>("/api/workout-day", {
        day: plan.day,
        routineId: selection === "rest" ? null : Number(selection),
        jiuJitsu,
      });
      setPlan(next);
      setSuggestion(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save today’s choice.");
    } finally {
      setPending(null);
    }
  }

  async function askCoach() {
    if (!plan?.choice) return;
    setPending("coach");
    setError("");
    try {
      setSuggestion(await apiPost<TrainingSuggestion>("/api/coach/training", {
        day: plan.day,
        ...plan.choice,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get training suggestions.");
    } finally {
      setPending(null);
    }
  }

  async function start() {
    const routineId = plan?.choice?.routineId;
    if (routineId == null) return;
    setPending("start");
    setError("");
    try {
      const session = await apiPost<{ id: number }>("/api/sessions", { routineId });
      router.push(`/workouts/session/${session.id}?hype=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start workout.");
      setPending(null);
    }
  }

  const savedChoice = !!plan?.choice && selection === selectionValue(plan) && jiuJitsu === plan.choice.jiuJitsu;

  return (
    <section className="card space-y-3 border-t-accent/65 p-4 min-[360px]:p-5" aria-labelledby={`${fieldId}-title`}>
      <h2 id={`${fieldId}-title`} className="font-display text-2xl">Today’s training</h2>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!plan ? (
        error
          ? <button className="btn-ghost min-h-11" onClick={load}>Retry</button>
          : <p role="status" className="text-sm text-muted">Loading today’s training…</p>
      ) : (
        <>
          {plan.activeSessionId !== null ? (
            <Link className="btn-primary min-h-11 w-full" href={`/workouts/session/${plan.activeSessionId}`}>
              <Play size={17} /> Resume workout
            </Link>
          ) : plan.completedToday && (
            <p className="text-sm text-accent">Workout logged today</p>
          )}
          <label htmlFor={fieldId} className="block text-sm text-muted">What do you want to train?</label>
          <div className="relative">
            <select
              className="input min-h-11 w-full pr-10"
              id={fieldId}
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
              disabled={pending !== null}
            >
              <option value="" disabled>Choose a routine or rest</option>
              {plan.routines.map((routine) => (
                <option key={routine.id} value={routine.id}>{routine.name}</option>
              ))}
              <option value="rest">{jiuJitsu ? "No gym workout" : "Rest & recovery"}</option>
            </select>
            <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
          </div>
          {plan.routines.length === 0 && (
            <p className="text-sm text-muted">Add exercises to a routine in <Link className="text-accent underline" href="/workouts">Workouts</Link> to choose it here.</p>
          )}
          {!plan.choice && plan.defaultRoutineId !== null && (
            <p className="text-xs text-muted">Your weekly default is selected. You can change it for today.</p>
          )}
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={jiuJitsu}
              disabled={pending !== null}
              onChange={(event) => {
                setJiuJitsu(event.target.checked);
                if (event.target.checked && !selection) setSelection("rest");
              }}
              className="h-5 w-5 accent-accent"
            />
            <span>Jiu-jitsu today</span>
          </label>
          {!savedChoice ? (
            <button className="btn-primary min-h-11 w-full" onClick={saveChoice} disabled={!selection || pending !== null}>
              {pending === "save" ? "Saving…" : "Save today’s choice"}
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {plan.choice?.routineId != null && plan.activeSessionId === null && (
                <button className="btn-primary min-h-11 flex-1 whitespace-nowrap" onClick={start} disabled={pending !== null}>
                  <Play size={17} /> {pending === "start" ? "Starting…" : "Start workout"}
                </button>
              )}
              <button className="btn-ghost min-h-11 flex-1 whitespace-nowrap" onClick={askCoach} disabled={pending !== null}>
                <Sparkles size={17} /> {pending === "coach" ? "Thinking…" : "Ask Coach what’s next"}
              </button>
            </div>
          )}
          <button
            className="btn-ghost min-h-11 w-full"
            onClick={() => setLoggingJiuJitsu(true)}
            disabled={pending !== null}
          >
            Log jiu-jitsu
          </button>
          {loggingJiuJitsu && (
            <LogPastActivityModal initialType={JIU_JITSU} onClose={() => setLoggingJiuJitsu(false)} />
          )}
          {savedChoice && suggestion && (
            <div className="space-y-2 border-t border-border pt-3" aria-live="polite">
              <h3 className="font-semibold">Coach’s suggestions</h3>
              <ol className="space-y-3">
                {suggestion.upcoming.map(({ routineId, reason }, index) => (
                  <li key={index} className="min-w-0 break-words">
                    <p className="text-xs text-muted">{formatDate(shiftISODate(plan.day, index + 1))}</p>
                    <p className="font-medium">{plan.routines.find((routine) => routine.id === routineId)?.name ?? "Rest & recovery"}</p>
                    <p className="text-sm text-muted">{reason}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}
