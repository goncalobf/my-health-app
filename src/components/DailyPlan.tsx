"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Check, Flame, Play, RefreshCw } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

interface Proposal {
  ready: boolean; message?: string;
  proposed?: { targetCalories: number; targetProteinG: number; targetCarbsG: number; targetFatG: number };
  current?: { targetCalories: number };
  evidence?: { averageGarminCalories: number; averageIntake: number; observedWeeklyKg: number; desiredWeeklyKg: number };
}

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
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => { apiGet<Proposal>("/api/adaptive-targets").then(setProposal).catch(() => null); }, []);

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

  async function acceptTarget() {
    if (!proposal?.proposed) return;
    await apiPatch("/api/settings", { ...proposal.proposed, reviewAdaptiveTarget: true });
    setAccepted(true); router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card p-4">
        <p className="label">Today&apos;s training</p>
        <div className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center"><Activity size={20} /></div>
          <div className="flex-1"><p className="font-semibold">{activeSessionId ? "Workout in progress" : routine?.name ?? "Rest & recovery"}</p><p className="text-xs text-muted">{routine ? "Scheduled session" : "No workout scheduled"}</p></div>
          {(routine || activeSessionId) && <button onClick={start} disabled={starting} className="btn-primary py-2 px-3"><Play size={16} /> {activeSessionId ? "Resume" : "Start"}</button>}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2"><Flame size={18} className="text-warn" /><p className="font-semibold">Garmin total calories</p></div>
        <div className="flex gap-2">
          <input type="number" inputMode="numeric" className="input flex-1" placeholder="Today’s total" value={burn}
            onChange={(e) => { setBurn(e.target.value); setBurnSaved(false); }} />
          <button onClick={saveBurn} disabled={!burn || burnSaved} className="btn-ghost px-3">{burnSaved ? <Check size={18} /> : "Save"}</button>
        </div>
        <p className="text-[11px] text-muted mt-2">Copy the Total Calories value from your Forerunner 165 / Garmin Connect.</p>
      </div>

      {proposal?.ready && proposal.proposed && proposal.current && proposal.proposed.targetCalories !== proposal.current.targetCalories && (
        <div className="card p-4 border-accent/40">
          <div className="flex items-center gap-2"><RefreshCw size={17} className="text-accent" /><p className="font-semibold">Two-week target review</p></div>
          <p className="text-sm mt-2">Suggested target: <strong>{proposal.proposed.targetCalories} kcal</strong> · {proposal.proposed.targetProteinG}P · {proposal.proposed.targetCarbsG}C · {proposal.proposed.targetFatG}F</p>
          {proposal.evidence && <p className="text-xs text-muted mt-1">Garmin avg {proposal.evidence.averageGarminCalories} kcal · weight trend {proposal.evidence.observedWeeklyKg > 0 ? "+" : ""}{proposal.evidence.observedWeeklyKg} kg/week</p>}
          <button onClick={acceptTarget} disabled={accepted} className="btn-primary w-full mt-3">{accepted ? <><Check size={18} /> Applied</> : "Apply recommendation"}</button>
        </div>
      )}
    </div>
  );
}
