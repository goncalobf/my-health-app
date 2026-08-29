"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flame, Play } from "lucide-react";
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
      <div className="card overflow-hidden p-4 min-[360px]:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="label">Today&apos;s training</p>
          <span className="font-display text-sm tracking-[0.14em] text-muted">Session / 01</span>
        </div>
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="break-words font-display text-3xl uppercase leading-none tracking-[0.025em] min-[360px]:text-4xl">{activeSessionId ? "Workout in progress" : routine?.name ?? "Rest & recovery"}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted">{routine ? "Scheduled session" : "No workout scheduled"}</p>
          </div>
          {(routine || activeSessionId) && <button onClick={start} disabled={starting} className="btn-primary h-12 shrink-0 px-3 min-[360px]:px-4"><Play size={17} fill="currentColor" /> {activeSessionId ? "Resume" : "Start"}</button>}
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center gap-2"><Flame size={17} className="text-warn" /><p className="font-display text-lg tracking-[0.06em]">Garmin energy</p><span className="ml-auto text-[10px] uppercase tracking-widest text-muted">Daily total</span></div>
        <div className="flex gap-2">
          <input type="number" inputMode="numeric" className="input min-w-0 flex-1" placeholder="Today’s total" value={burn}
            onChange={(e) => { setBurn(e.target.value); setBurnSaved(false); }} />
          <button onClick={saveBurn} disabled={!burn || burnSaved} className="btn-ghost px-3">{burnSaved ? <Check size={18} /> : "Save"}</button>
        </div>
        <p className="mt-2 text-[10px] uppercase leading-relaxed tracking-[0.08em] text-muted">Forerunner 165 / Garmin Connect total calories</p>
      </div>

    </div>
  );
}
