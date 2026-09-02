"use client";

import { Droplets } from "lucide-react";
import { calculateHydrationTarget } from "@/lib/hydration";

export default function HydrationCard({
  weightKg,
  creatineLoading,
  onToggleCreatineLoading,
}: {
  weightKg: number | null;
  creatineLoading: boolean;
  onToggleCreatineLoading: (value: boolean) => void;
}) {
  if (!weightKg) {
    return (
      <div className="card p-4 min-[360px]:p-5">
        <div className="flex items-center gap-2"><Droplets size={18} className="text-accent" /><p className="label">Hydration</p></div>
        <p className="mt-2 text-sm text-muted">Add your current weight in Settings to see a daily water target.</p>
      </div>
    );
  }

  const { baselineLiters, targetLiters } = calculateHydrationTarget({ weightKg, creatineLoading });

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
      {creatineLoading && (
        <p className="mt-1 text-[11px] text-muted">{baselineLiters} L baseline + 1.25 L while loading creatine</p>
      )}
      <label className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="min-w-0 flex-1 text-sm">
          Loading creatine
          <span className="mt-0.5 block text-[11px] text-muted">Adds ~1.25 L/day while a loading phase (commonly 20 g/day) is active</span>
        </span>
        <input
          type="checkbox"
          checked={creatineLoading}
          onChange={(e) => onToggleCreatineLoading(e.target.checked)}
          className="h-6 w-6 shrink-0 accent-accent"
          aria-label="Creatine loading phase"
        />
      </label>
    </div>
  );
}
