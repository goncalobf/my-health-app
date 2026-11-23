"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Watch } from "lucide-react";
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

      <details className="card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="icon-frame h-8 w-8"><Watch size={16} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1 text-sm font-extrabold">Garmin daily energy</span>
          {garminCalories != null && <span className="text-xs font-semibold text-muted">{garminCalories} kcal</span>}
          <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden="true" />
        </summary>
        <div className="px-4 pb-4">
          <label className="label" htmlFor="garmin-daily-calories">Total calories in Garmin Connect</label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="garmin-daily-calories"
              disabled={saving}
              type="number"
              inputMode="numeric"
              className="input min-w-0 flex-1"
              value={burn}
              onChange={(e) => { setBurn(e.target.value); setBurnSaved(false); }}
            />
            <button onClick={saveBurn} disabled={!burn || burnSaved || saving} className="btn-ghost">
              {burnSaved ? <><Check size={17} /> Saved</> : saving ? "Saving…" : "Save"}
            </button>
          </div>
          {burnError && <p role="alert" className="mt-2 text-sm text-danger">{burnError}</p>}
        </div>
      </details>
    </div>
  );
}
