"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Check, Sparkles } from "lucide-react";
import { apiGet, apiPatch, api, apiPost } from "@/lib/api";
import type { CoachTargetPayload } from "@/lib/coach";
import PageHeader from "@/components/PageHeader";

interface Targets {
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  goal: string;
  targetWeeklyChangePct: number;
  adaptiveTargets: boolean;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  biologicalSex: "male" | "female" | "unspecified";
}

interface ScheduleRow { dayOfWeek: number; day: string; routineId: number | null; }
interface RoutineRow { id: number; name: string; }

export default function SettingsPage() {
  const router = useRouter();
  const [t, setT] = useState<Targets | null>(null);
  const [saved, setSaved] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [routines, setRoutines] = useState<RoutineRow[]>([]);
  const [recommendation, setRecommendation] =
    useState<CoachTargetPayload | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

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

  async function recommendTargets() {
    if (!t) return;
    setAiLoading(true);
    setAiError("");
    setRecommendation(null);
    try {
      await apiPatch("/api/settings", t);
      setRecommendation(
        await apiPost<CoachTargetPayload>("/api/coach/targets", {})
      );
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "Could not calculate targets."
      );
    } finally {
      setAiLoading(false);
    }
  }

  async function applyRecommendation() {
    if (!t || !recommendation) return;
    const next = {
      ...t,
      targetCalories: recommendation.targetCalories,
      targetProteinG: recommendation.targetProteinG,
      targetCarbsG: recommendation.targetCarbsG,
      targetFatG: recommendation.targetFatG,
      lastTargetReviewAt: new Date().toISOString(),
    };
    await apiPatch("/api/settings", {
      targetCalories: next.targetCalories,
      targetProteinG: next.targetProteinG,
      targetCarbsG: next.targetCarbsG,
      targetFatG: next.targetFatG,
      reviewAdaptiveTarget: true,
    });
    setT(next);
    setRecommendation(null);
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

      <h2 className="text-sm font-semibold text-muted mb-2">Your profile</h2>
      <div className="card p-4 flex flex-col gap-3">
        <ProfileNumber
          label="Current weight"
          detail="Updated when you log a weigh-in"
          value={t.currentWeightKg}
          unit="kg"
          step={0.1}
          onChange={(value) => setT({ ...t, currentWeightKg: value })}
        />
        <ProfileNumber
          label="Goal weight"
          detail="Your target milestone"
          value={t.goalWeightKg}
          unit="kg"
          step={0.1}
          onChange={(value) => setT({ ...t, goalWeightKg: value })}
        />
        <ProfileNumber
          label="Height"
          detail="Used for energy estimates"
          value={t.heightCm}
          unit="cm"
          step={1}
          onChange={(value) => setT({ ...t, heightCm: value })}
        />
        <ProfileNumber
          label="Age"
          detail="Used for energy estimates"
          value={t.ageYears}
          unit="years"
          step={1}
          onChange={(value) => setT({ ...t, ageYears: value })}
        />
        <label>
          <span className="label">Biological sex</span>
          <select
            className="input mt-1"
            value={t.biologicalSex}
            onChange={(e) =>
              setT({
                ...t,
                biologicalSex: e.target.value as Targets["biologicalSex"],
              })
            }
          >
            <option value="unspecified">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
          <span className="text-[11px] text-muted mt-1 block">
            Garmin and your real weight trend take priority when enough data is available.
          </span>
        </label>
        <button onClick={save} className="btn-primary mt-1">
          {saved ? (
            <>
              <Check size={18} /> Saved
            </>
          ) : (
            "Save profile"
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
      </div>

      <h2 className="text-sm font-semibold text-muted mb-2 mt-6">Daily targets</h2>
      <div className="card p-4 flex flex-col gap-3 mt-2">
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
        <button
          onClick={recommendTargets}
          disabled={aiLoading}
          className="btn-ghost"
        >
          <Sparkles size={18} />
          {aiLoading ? "Coach is calculating…" : "Calculate targets with AI"}
        </button>
        <p className="text-[11px] text-muted">
          Uses your profile, goal, training, Garmin calories, intake and weight trend. Nothing changes until you apply it.
        </p>
        {aiError && <p className="text-sm text-danger">{aiError}</p>}
        {recommendation && (
          <div className="bg-surface-2 border border-accent/30 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">Coach recommendation</p>
              <span className="text-[10px] uppercase text-muted">
                {recommendation.dataQuality} data
              </span>
            </div>
            <p className="text-lg font-bold text-accent mt-2">
              {recommendation.targetCalories} kcal
            </p>
            <p className="text-sm">
              {recommendation.targetProteinG}g protein · {recommendation.targetCarbsG}g carbs · {recommendation.targetFatG}g fat
            </p>
            <p className="text-sm text-muted mt-2">{recommendation.summary}</p>
            <ul className="text-xs text-muted mt-2 list-disc pl-4 space-y-1">
              {recommendation.rationale.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {recommendation.caution && (
              <p className="text-xs text-warn mt-2">{recommendation.caution}</p>
            )}
            <button onClick={applyRecommendation} className="btn-primary w-full mt-3">
              Apply these targets
            </button>
          </div>
        )}
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

function ProfileNumber({
  label,
  detail,
  value,
  unit,
  step,
  onChange,
}: {
  label: string;
  detail: string;
  value: number | null;
  unit: string;
  step: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>
        <span className="font-medium block">{label}</span>
        <span className="text-xs text-muted">{detail}</span>
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={step}
          className="w-24 input text-right"
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
        <span className="text-xs text-muted w-9">{unit}</span>
      </div>
    </label>
  );
}
