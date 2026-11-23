"use client";

import { ArrowRight, Dumbbell } from "lucide-react";

export default function HypeScreen({ workoutName, totalSets, exerciseCount, onStart }: {
  workoutName: string;
  totalSets: number;
  exerciseCount: number;
  onStart: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-bg px-4 py-8">
      <section className="card w-full max-w-lg overflow-hidden">
        <div className="bg-accent-soft p-6 min-[375px]:p-8">
          <span className="icon-frame bg-surface"><Dumbbell size={20} aria-hidden="true" /></span>
          <p className="mt-4 text-xs font-extrabold text-accent">Workout preview</p>
          <h1 className="mt-1 break-words font-display text-4xl leading-tight">{workoutName}</h1>
          {exerciseCount > 0 && (
            <p className="mt-2 text-sm font-semibold text-muted">
              {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"} · {totalSets} planned {totalSets === 1 ? "set" : "sets"}
            </p>
          )}
        </div>
        <div className="space-y-4 p-5 min-[375px]:p-6">
          <p className="text-sm leading-relaxed text-muted">You can adjust the weight, skip sets, or finish whenever you’re ready.</p>
          <button onClick={onStart} className="btn-primary w-full">
            Start workout <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
