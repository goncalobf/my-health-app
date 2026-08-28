"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Check } from "lucide-react";
import { apiGet, apiPatch, api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

interface Targets {
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  goal: string;
  targetWeeklyChangePct: number;
  adaptiveTargets: boolean;
  goalWeightKg: number | null;
}

interface ScheduleRow { dayOfWeek: number; day: string; routineId: number | null; }
interface RoutineRow { id: number; name: string; }

export default function SettingsPage() {
  const router = useRouter();
  const [t, setT] = useState<Targets | null>(null);
  const [saved, setSaved] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);

  useEffect(() => {
    Promise.all([
      apiGet<Targets>("/api/settings"),
      apiGet<ScheduleRow[]>("/api/schedule"),
      apiGet<RoutineRow[]>("/api/routines"),
    ]).then(([targets, days, routineRows]) => {
      setT(targets); setSchedule(days); setRoutines(routineRows);
    });
  }, []);

  async function save() {
    if (!t) return;
    await apiPatch("/api/settings", t);
    await api("/api/schedule", {
      method: "PUT",
      body: JSON.stringify({ entries: schedule }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function logout() {
    await api("/api/auth", { method: "DELETE" });
    router.replace("/unlock");
    router.refresh();
  }

  if (!t) return <p className="text-muted text-sm">Loading…</p>;

  const fields: { key: "targetCalories" | "targetProteinG" | "targetCarbsG" | "targetFatG"; label: string; unit: string }[] = [
    { key: "targetCalories", label: "Calories", unit: "kcal" },
    { key: "targetProteinG", label: "Protein", unit: "g" },
    { key: "targetCarbsG", label: "Carbs", unit: "g" },
    { key: "targetFatG", label: "Fat", unit: "g" },
  ];

  return (
    <div>
      <PageHeader title="Settings" back="/" />

      <h2 className="text-sm font-semibold text-muted mb-2">Daily targets</h2>
      <div className="card p-4 flex flex-col gap-3">
        {fields.map((f) => (
          <label key={f.key} className="flex items-center justify-between gap-3">
            <span className="font-medium">{f.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                className="w-24 bg-surface-2 border border-border rounded-lg px-3 py-2 text-right tabular-nums outline-none focus:border-accent"
                value={t[f.key]}
                onChange={(e) =>
                  setT({ ...t, [f.key]: Number(e.target.value) })
                }
              />
              <span className="text-xs text-muted w-8">{f.unit}</span>
            </div>
          </label>
        ))}
        <button onClick={save} className="btn-primary mt-1">
          {saved ? (
            <>
              <Check size={18} /> Saved
            </>
          ) : (
            "Save targets"
          )}
        </button>
      </div>

      <h2 className="text-sm font-semibold text-muted mb-2 mt-6">Goal</h2>
      <div className="card p-4 flex flex-col gap-3">
        <label>
          <span className="label">Training goal</span>
          <select
            className="input mt-1"
            value={t.goal}
            onChange={(e) => setT({ ...t, goal: e.target.value })}
          >
            <option value="recomposition">Lose fat + gain muscle</option>
            <option value="fat_loss">Lose fat</option>
            <option value="maintenance">Maintain</option>
            <option value="muscle_gain">Gain muscle</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="font-medium block">Weekly weight change</span>
            <span className="text-xs text-muted">Percent of bodyweight</span>
          </span>
          <div className="flex items-center gap-2">
            <input type="number" step={0.05} className="w-24 input text-right"
              value={t.targetWeeklyChangePct}
              onChange={(e) => setT({ ...t, targetWeeklyChangePct: Number(e.target.value) })} />
            <span className="text-xs text-muted">%</span>
          </div>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="font-medium block">Goal weight</span>
            <span className="text-xs text-muted">Optional milestone</span>
          </span>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="decimal" step={0.1} className="w-24 input text-right" value={t.goalWeightKg ?? ""}
              onChange={(e) => setT({ ...t, goalWeightKg: e.target.value ? Number(e.target.value) : null })} />
            <span className="text-xs text-muted">kg</span>
          </div>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="font-medium block">Adaptive targets</span>
            <span className="text-xs text-muted">Review Garmin, food and weight trends</span>
          </span>
          <input type="checkbox" checked={t.adaptiveTargets}
            onChange={(e) => setT({ ...t, adaptiveTargets: e.target.checked })}
            className="w-5 h-5 accent-accent" />
        </label>
      </div>

      <h2 className="text-sm font-semibold text-muted mb-2 mt-6">Weekly schedule</h2>
      <div className="card p-4 flex flex-col gap-3">
        {schedule.map((row) => (
          <label key={row.dayOfWeek} className="flex items-center gap-3">
            <span className="font-medium w-24">{row.day}</span>
            <select className="input py-2 flex-1" value={row.routineId ?? ""}
              onChange={(e) => setSchedule((days) => days.map((d) => d.dayOfWeek === row.dayOfWeek ? { ...d, routineId: e.target.value ? Number(e.target.value) : null } : d))}>
              <option value="">Rest</option>
              {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        ))}
        <button onClick={save} className="btn-primary">Save schedule & settings</button>
      </div>

      <button onClick={logout} className="btn-ghost w-full mt-6">
        <LogOut size={18} /> Lock app
      </button>
    </div>
  );
}
