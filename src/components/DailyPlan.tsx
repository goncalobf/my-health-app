"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, Flame, Play } from "lucide-react";
import { apiPost } from "@/lib/api";

export default function DailyPlan({ day, routine, activeSessionId, garminCalories }: {
  day: string;
  routine: { id: number; name: string } | null;
  activeSessionId: number | null;
  garminCalories: number | null;
}) {
  const router = useRouter();
  const [burn, setBurn] = useState(garminCalories ? String(garminCalories) : "");
  const [burnSaved, setBurnSaved] = useState(!!garminCalories);
  const [starting, setStarting] = useState(false);

  async function start() {
    if (activeSessionId) { router.push(`/workouts/session/${activeSessionId}`); return; }
    if (!routine) return;
    setStarting(true);
    try {
      const row = await apiPost<{ id: number }>("/api/sessions", { routineId: routine.id });
      router.push(`/workouts/session/${row.id}`);
    } finally { setStarting(false); }
  }

  async function saveBurn() {
    await apiPost("/api/expenditure", { day, totalCalories: Number(burn) });
    setBurnSaved(true); router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-3 min-[360px]:p-4">
        <p className="label">Today&apos;s training</p>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-accent/15 text-accent flex items-center justify-center"><Activity size={20} /></div>
          <div className="min-w-0 flex-1"><p className="break-words font-semibold leading-snug">{activeSessionId ? "Workout in progress" : routine?.name ?? "Rest & recovery"}</p><p className="text-xs text-muted">{routine ? "Scheduled session" : "No workout scheduled"}</p></div>
          {(routine || activeSessionId) && <button onClick={start} disabled={starting} className="btn-primary shrink-0 py-2 px-2.5 min-[360px]:px-3"><Play size={16} /> {activeSessionId ? "Resume" : "Start"}</button>}
        </div>
      </div>

      <div className="card p-3 min-[360px]:p-4">
        <div className="flex items-center gap-2 mb-2"><Flame size={18} className="text-warn" /><p className="font-semibold">Garmin total calories</p></div>
        <div className="flex gap-2">
          <input type="number" inputMode="numeric" className="input min-w-0 flex-1" placeholder="Today’s total" value={burn}
            onChange={(e) => { setBurn(e.target.value); setBurnSaved(false); }} />
          <button onClick={saveBurn} disabled={!burn || burnSaved} className="btn-ghost px-3">{burnSaved ? <Check size={18} /> : "Save"}</button>
        </div>
        <p className="text-[11px] text-muted mt-2">Copy the Total Calories value from your Forerunner 165 / Garmin Connect.</p>
      </div>

    </div>
  );
}
