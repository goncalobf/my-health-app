"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Images, Play, Timer } from "lucide-react";
import { apiPost } from "@/lib/api";
import { mobilityIllustrationPath, mobilityMinutes, mobilitySources, mobilitySteps, type MobilityRoutine } from "@/lib/mobility";
import { formatDuration } from "@/lib/utils";
import ExerciseImage from "./ExerciseImage";

export default function MobilitySession({ routine }: { routine: MobilityRoutine }) {
  const router = useRouter();
  const steps = mobilitySteps(routine);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [finishedAt, setFinishedAt] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [error, setError] = useState("");
  const current = steps[index];
  const sources = [...new Set(steps.map((step) => step.source))];

  function advance(done: boolean) {
    if (done) setCompleted(completed + 1);
    if (index + 1 === steps.length) {
      setFinishedAt(new Date().toISOString());
    } else {
      setIndex(index + 1);
    }
  }

  async function save() {
    if (!startedAt || !finishedAt || completed === 0 || saveInFlight.current) return;
    saveInFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const session = await apiPost<{ id: number }>("/api/mobility-sessions", {
        routineId: routine.id, startedAt, finishedAt,
      });
      router.replace(`/workouts/cardio/${session.id}/summary`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save mobility session.");
      setSaving(false);
      saveInFlight.current = false;
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-accent">{routine.mode} · about {mobilityMinutes(routine)} min</p>
        <h2 className="mt-1 break-words font-display text-4xl leading-none">{routine.name}</h2>
        <p className="mt-2 text-sm text-muted">{routine.focus}</p>
      </div>

      {finishedAt ? (
        <section className="card space-y-3 p-4">
          <h3 className="font-display text-2xl">Finish session</h3>
          <p className="text-sm text-muted">
            {completed ? `${completed} of ${steps.length} steps marked done.` : "Mark at least one step done to save a session."}
          </p>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="button" className="btn-primary w-full" disabled={saving || !completed} onClick={save}>
            <Check size={17} /> {saving ? "Saving…" : "Save to history"}
          </button>
          <button type="button" className="btn-ghost w-full" disabled={saving} onClick={() => {
            setFinishedAt(null);
            setStartedAt(null);
            setIndex(0);
            setCompleted(0);
            setError("");
          }}>
            Back to routine
          </button>
        </section>
      ) : startedAt ? (
        <>
          <section className="card space-y-3 p-4 min-[360px]:p-5">
            <p className="text-xs font-medium text-accent">Step {index + 1} of {steps.length}</p>
            <div aria-live="polite">
              <h3 className="break-words font-display text-3xl">{current.name}</h3>
              <p className="text-sm font-semibold">
                {"seconds" in current.dose ? `${current.dose.seconds} sec hold` : `${current.dose.reps} ${current.dose.reps === 1 ? "rep" : "reps"}`}
                {current.side && ` · ${current.side} side`}
              </p>
            </div>
            <MovementGuide step={current} />
            <p className="text-sm leading-relaxed text-muted">{current.cue}</p>
            {"seconds" in current.dose && <HoldTimer key={index} seconds={current.dose.seconds} />}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => advance(false)}>Skip</button>
              <button type="button" className="btn-primary" onClick={() => advance(true)}><Check size={17} /> Done</button>
            </div>
          </section>
          <button type="button" className="btn-ghost w-full" onClick={() => setFinishedAt(new Date().toISOString())}>
            Finish early
          </button>
        </>
      ) : (
        <>
          <div className="card space-y-3 p-4">
            <p className="text-sm"><strong>Equipment</strong> · {routine.equipment}</p>
            <p className="text-sm text-muted">Warm up with easy movement. Stay within a comfortable range and skip any exercise that causes pain.</p>
            <button type="button" className="btn-primary w-full" onClick={() => setStartedAt(new Date().toISOString())}>
              <Play size={17} /> Start routine
            </button>
          </div>
          <ol className="space-y-2" aria-label="Exercises in this routine">
            {steps.filter((step) => step.side !== "Right").map((step, i) => (
              <li key={step.id} className="card">
                <details className="group" open={i === 0}>
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl p-3 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                    <Images size={18} className="shrink-0 text-accent" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{step.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {"seconds" in step.dose ? `${step.dose.seconds} sec hold` : `${step.dose.reps} ${step.dose.reps === 1 ? "rep" : "reps"}`}
                        {step.side && " per side"}
                      </span>
                    </span>
                    <ChevronDown size={17} className="shrink-0 text-muted group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="space-y-2 px-3 pb-3">
                    <MovementGuide step={step} />
                    <p className="text-sm leading-relaxed text-muted">{step.cue}</p>
                  </div>
                </details>
              </li>
            ))}
          </ol>
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-medium">Exercise references</summary>
            <ul className="mt-2 space-y-2 text-sm">
              {sources.map((source) => (
                <li key={source}>
                  <a className="text-accent underline underline-offset-2" href={mobilitySources[source].url} target="_blank" rel="noreferrer">
                    {mobilitySources[source].name}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

function MovementGuide({ step }: { step: ReturnType<typeof mobilitySteps>[number] }) {
  return (
    <figure>
      <ExerciseImage
        key={step.id}
        name={step.name}
        imageUrl={mobilityIllustrationPath(step.id)}
        variant="illustration"
        className="aspect-[16/7] w-full"
      />
      <figcaption className="mt-1.5 grid grid-cols-2 gap-2 text-center text-xs font-semibold leading-snug text-muted">
        {step.frames.map((label) => <span key={label}>{label}</span>)}
      </figcaption>
    </figure>
  );
}

function HoldTimer({ seconds }: { seconds: number }) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (endsAt == null) return;
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemaining(next);
      if (!next) window.clearInterval(interval);
    }, 100);
    return () => window.clearInterval(interval);
  }, [endsAt]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border py-2">
      <span aria-label="Hold countdown" className="font-display text-3xl tabular-nums">{formatDuration(remaining)}</span>
      <button type="button" className="btn-ghost px-3" onClick={() => {
        setRemaining(seconds);
        setEndsAt(Date.now() + seconds * 1000);
      }}>
        <Timer size={17} /> {endsAt == null ? "Start hold" : "Restart hold"}
      </button>
      {!remaining && <p role="status" className="w-full text-sm text-accent">Hold complete</p>}
    </div>
  );
}
