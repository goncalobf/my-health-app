"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Dumbbell,
  Gauge,
  RefreshCcw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiGet, apiPatch } from "@/lib/api";

interface PlanExercise {
  exerciseId: number;
  exerciseName: string;
  exercisePosition: number;
  targetSets: number;
  minReps: number;
  maxReps: number;
  targetRirMin: number | null;
  targetRirMax: number | null;
  avoidFailure: boolean;
  instruction: string | null;
  supersetGroup: string | null;
  isAnchor: boolean;
}

interface PlanData {
  state: {
    blockStartedOn: string;
    isDeload: boolean;
    deloadStartedOn: string | null;
  };
  status: {
    week: number;
    triggerCount: number;
    weekLimitReached: boolean;
    deloadRecommended: boolean;
    headline: string;
    triggers: {
      key: string;
      active: boolean;
      label: string;
      detail: string;
    }[];
  };
  latestCheckin: {
    day: string;
    sleepPoor: boolean;
    appetiteLow: boolean;
    jointPain: boolean;
    notes: string | null;
  } | null;
  routines: {
    id: number;
    name: string;
    position: number;
    exercises: PlanExercise[];
  }[];
}

function formatRir(min: number | null, max: number | null) {
  if (min == null) return "RIR –";
  return min === max || max == null ? `RIR ${min}` : `RIR ${min}–${max}`;
}

export default function TrainingPlanPage() {
  const [data, setData] = useState<PlanData | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checkin, setCheckin] = useState({
    sleepPoor: false,
    appetiteLow: false,
    jointPain: false,
    notes: "",
  });

  const load = useCallback(async () => {
    const next = await apiGet<PlanData>("/api/training-plan");
    setData(next);
    setCheckin({
      sleepPoor: next.latestCheckin?.sleepPoor ?? false,
      appetiteLow: next.latestCheckin?.appetiteLow ?? false,
      jointPain: next.latestCheckin?.jointPain ?? false,
      notes: next.latestCheckin?.notes ?? "",
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const safetyExercises = useMemo(
    () =>
      data
        ? [
            ...new Set(
              data.routines.flatMap((routine) =>
                routine.exercises
                  .filter((exercise) => exercise.avoidFailure)
                  .map((exercise) => exercise.exerciseName)
              )
            ),
          ]
        : [],
    [data]
  );

  async function planAction(action: "start_deload" | "finish_deload" | "start_new_block") {
    if (
      action === "start_new_block" &&
      !window.confirm("Start a new build block and reset the week counter to week 1?")
    ) return;
    setBusy(true);
    try {
      await apiPatch("/api/training-plan", { action });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveCheckin() {
    setBusy(true);
    try {
      await apiPatch("/api/training-plan", { action: "checkin", ...checkin });
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-sm text-muted">Loading training plan…</p>;

  const { state, status } = data;
  return (
    <div>
      <PageHeader title="Plan & progression" back="/workouts" />

      <section className={`card p-4 ${status.deloadRecommended || state.isDeload ? "border-warn/40 bg-warn/10" : "border-accent/30 bg-accent/10"}`}>
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${status.deloadRecommended || state.isDeload ? "bg-warn/15 text-warn" : "bg-accent/15 text-accent"}`}>
            {state.isDeload ? <RefreshCcw size={20} /> : <TrendingUp size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {state.isDeload ? "Deload" : `Mesocycle · week ${status.week}`}
            </p>
            <h2 className="mt-0.5 text-lg font-bold">{status.headline}</h2>
            <p className="mt-1 text-sm text-muted">
              {state.isDeload
                ? "Use half the normal sets, about 60% of your normal load and RIR 4+ for one week."
                : status.deloadRecommended
                  ? status.weekLimitReached
                    ? "You reached week 7. The plan schedules a deload even without two fatigue signals."
                    : `${status.triggerCount} of 3 fatigue signals are active, so the plan recommends a deload next week.`
                  : "Keep using double progression and review the fatigue signals below."}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
          {state.isDeload ? (
            <button onClick={() => planAction("finish_deload")} disabled={busy} className="btn-primary min-[380px]:col-span-2">
              <Check size={18} /> Finish deload & start week 1
            </button>
          ) : (
            <>
              <button onClick={() => planAction("start_deload")} disabled={busy} className={status.deloadRecommended ? "btn-primary" : "btn-ghost"}>
                <RefreshCcw size={18} /> Start deload
              </button>
              <button onClick={() => planAction("start_new_block")} disabled={busy} className="btn-ghost">
                Reset to week 1
              </button>
            </>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-muted">Double progression</h2>
        <div className="card p-4">
          <ol className="space-y-3">
            {[
              ["1", "Start low", "Choose a load you can perform at the bottom of the rep range with the target RIR."],
              ["2", "Add repetitions", "Keep the same load and gradually add reps while preserving technique and RIR."],
              ["3", "Complete the range", "Only increase weight after every planned set reaches the top of the range."],
              ["4", "Increase and rebuild", "Add the configured increment, return to the bottom of the range and repeat."],
            ].map(([number, title, detail]) => (
              <li key={number} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{number}</span>
                <div className="min-w-0"><p className="font-medium">{title}</p><p className="text-xs leading-relaxed text-muted">{detail}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2"><Gauge size={17} className="text-accent" /><h2 className="text-sm font-semibold text-muted">Understanding RIR</h2></div>
        <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
          {[
            ["3", "3 good reps left"], ["2", "2 good reps left"],
            ["1", "1 good rep left"], ["0", "Technical failure"],
          ].map(([rir, meaning]) => (
            <div key={rir} className="card p-3 text-center"><p className="text-xl font-bold text-accent">RIR {rir}</p><p className="mt-1 text-[11px] text-muted">{meaning}</p></div>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">Log your honest RIR after each set. Slower bar speed and changing technique usually mean fewer reps remain.</p>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2"><AlertTriangle size={17} className="text-warn" /><h2 className="text-sm font-semibold text-muted">Deload signals</h2></div>
        <div className="flex flex-col gap-2">
          {status.triggers.map((trigger) => (
            <div key={trigger.key} className={`card flex items-start gap-3 p-3 ${trigger.active ? "border-warn/40" : ""}`}>
              <span className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${trigger.active ? "bg-warn" : "bg-surface-2 ring-1 ring-border"}`} />
              <div><p className="text-sm font-medium">{trigger.label}</p><p className="mt-0.5 text-xs leading-relaxed text-muted">{trigger.detail}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-muted">Recovery check-in</h2>
        <div className="card flex flex-col gap-3 p-4">
          {[
            ["sleepPoor", "Sleep has worsened"],
            ["appetiteLow", "Appetite is unusually low"],
            ["jointPain", "Joint discomfort appears during warm-up and persists"],
          ].map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={checkin[key as keyof typeof checkin] as boolean}
                onChange={(event) => setCheckin((value) => ({ ...value, [key]: event.target.checked }))}
                className="mt-0.5 h-5 w-5 accent-accent"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
          <textarea className="input min-h-20 resize-y" placeholder="Recovery notes (optional)" value={checkin.notes} onChange={(event) => setCheckin((value) => ({ ...value, notes: event.target.value }))} />
          <button onClick={saveCheckin} disabled={busy} className="btn-primary">
            {saved ? <><Check size={18} /> Saved</> : "Save today’s check-in"}
          </button>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2"><ShieldCheck size={17} className="text-danger" /><h2 className="text-sm font-semibold text-muted">Never train these to failure</h2></div>
        <div className="card p-4"><p className="text-sm leading-relaxed">{safetyExercises.join(" · ")}</p><p className="mt-2 text-xs text-muted">Keep these at approximately RIR 2 even when the rest of the mesocycle becomes harder.</p></div>
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2"><Dumbbell size={17} className="text-muted" /><h2 className="text-sm font-semibold text-muted">Routine prescriptions</h2></div>
        <div className="flex flex-col gap-2">
          {data.routines.map((routine) => (
            <details key={routine.id} className="card group overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <span className="min-w-0 flex-1 font-semibold">{routine.name}</span>
                <span className="text-xs text-muted">{routine.exercises.length} exercises</span>
                <ChevronDown size={17} className="shrink-0 text-muted transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-border px-3 pb-3">
                {routine.exercises.map((exercise) => (
                  <div key={`${routine.id}-${exercise.exerciseId}`} className="border-b border-border py-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 font-medium">{exercise.exerciseName}</p>
                      <span className="shrink-0 text-xs text-muted">{exercise.targetSets} × {exercise.minReps}–{exercise.maxReps}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">{formatRir(exercise.targetRirMin, exercise.targetRirMax)}</span>
                      {exercise.isAnchor && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] text-warn">Anchor</span>}
                      {exercise.avoidFailure && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] text-danger">Never failure</span>}
                      {exercise.supersetGroup && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] text-warn">Superset</span>}
                    </div>
                    {exercise.instruction && <p className="mt-1.5 text-xs leading-relaxed text-muted">{exercise.instruction}</p>}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
