"use client";

import { Droplets } from "lucide-react";
import { calculateHydrationTarget, type CreatinePhase } from "@/lib/hydration";

const PHASES: { value: CreatinePhase; label: string }[] = [
  { value: "none", label: "Not taking it" },
  { value: "loading", label: "Loading" },
  { value: "maintenance", label: "Maintenance" },
];

export default function HydrationCard({
  weightKg,
  creatinePhase,
  onChangePhase,
}: {
  weightKg: number | null;
  creatinePhase: CreatinePhase;
  onChangePhase: (phase: CreatinePhase) => void;
}) {
  if (!weightKg) {
    return (
      <div className="card p-4 min-[360px]:p-5">
        <div className="flex items-center gap-2"><Droplets size={18} className="text-accent" /><p className="label">Hydration</p></div>
        <p className="mt-2 text-sm text-muted">Add your current weight in Settings to see a daily water target.</p>
      </div>
    );
  }

  const { baselineLiters, targetLiters } = calculateHydrationTarget({ weightKg, creatinePhase });

  return (
    <div className="card p-4 min-[360px]:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Droplets size={18} className="text-accent" /><p className="label">Hydration</p></div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted">35–40 ml/kg</p>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="data-number text-4xl leading-none min-[360px]:text-5xl">{targetLiters}</p>
        <p className="text-sm text-muted">L / day target</p>
      </div>
      {creatinePhase === "loading" && (
        <p className="mt-1 text-[11px] text-muted">{baselineLiters} L baseline + 1.25 L while loading creatine</p>
      )}
      {creatinePhase === "maintenance" && (
        <p className="mt-1 text-[11px] text-muted">No extra bump on a maintenance dose — baseline already covers the commonly cited maintenance range</p>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-1.5 text-sm">Creatine</p>
        <div className="flex gap-1.5">
          {PHASES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChangePhase(value)}
              className={`min-w-0 flex-1 py-2 text-xs font-medium transition active:scale-95 [border-radius:2px_7px_2px_2px] ${
                creatinePhase === value ? "bg-accent text-bg" : "border border-border bg-surface-2 text-muted"
              }`}
              aria-pressed={creatinePhase === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
