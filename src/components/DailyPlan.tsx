"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flame } from "lucide-react";
import { apiPost } from "@/lib/api";
import WorkoutDayCard from "./WorkoutDayCard";

export default function DailyPlan({ day, garminCalories }: {
  day: string;
  garminCalories: number | null;
}) {
  const router = useRouter();
  const [burn, setBurn] = useState(garminCalories ? String(garminCalories) : "");
  const [burnSaved, setBurnSaved] = useState(!!garminCalories);
  const [burnError, setBurnError] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveBurn() {
    setSaving(true);
    setBurnError("");
    try {
      await apiPost("/api/expenditure", { day, totalCalories: Number(burn) });
      setBurnSaved(true);
      router.refresh();
    } catch (e) {
      setBurnError(e instanceof Error ? e.message : "Could not save Garmin energy.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <WorkoutDayCard />

      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2"><Flame size={17} className="text-warn" /><p className="font-display text-lg tracking-[0.06em]">Garmin energy</p><span className="ml-auto text-[10px] uppercase tracking-widest text-muted">Daily total</span></div>
        <div className="flex gap-2">
          <input aria-label="Today’s Garmin calories" disabled={saving} type="number" inputMode="numeric" className="input min-w-0 flex-1" placeholder="Today’s total" value={burn}
            onChange={(e) => { setBurn(e.target.value); setBurnSaved(false); }} />
          <button onClick={saveBurn} disabled={!burn || burnSaved || saving} className="btn-ghost px-3">{burnSaved ? <Check size={18} /> : "Save"}</button>
        </div>
        {burnError && <p role="alert" className="mt-2 text-sm text-danger">{burnError}</p>}
        <p className="mt-2 text-[10px] uppercase leading-relaxed tracking-[0.08em] text-muted">Forerunner 165 / Garmin Connect total calories</p>
      </div>

    </div>
  );
}
