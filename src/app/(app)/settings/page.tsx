"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Check, Sparkles, Users, UserPlus, ChevronRight } from "lucide-react";
import { apiGet, apiPatch, api, apiPost } from "@/lib/api";
import type { CoachTargetPayload } from "@/lib/coach";
import PageHeader from "@/components/PageHeader";
import { authClient } from "@/lib/auth-client";
import GarminSettings from "@/components/GarminSettings";

interface Targets {
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  goal: string;
  goalStartedOn: string | null;
  targetWeeklyChangePct: number;
  adaptiveTargets: boolean;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  biologicalSex: "male" | "female" | "unspecified";
  foodRegion: "PT" | "CH" | "both";
  foodLanguage: "pt" | "de" | "fr" | "it" | "en";
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
    await authClient.signOut();
    router.replace("/auth/sign-in");
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

      <Link href="/settings/access" className="card mb-6 flex items-center gap-3 p-4 active:scale-[0.99] transition">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><Users size={20} /></div>
        <div className="min-w-0 flex-1"><p className="font-semibold">Account & access</p><p className="text-xs text-muted">Your account, privacy and other users</p></div>
        <ChevronRight size={19} className="shrink-0 text-muted" />
      </Link>

      <Link href="/friends" className="card mb-6 flex items-center gap-3 p-4 active:scale-[0.99] transition">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><UserPlus size={20} /></div>
        <div className="min-w-0 flex-1"><p className="font-semibold">Friends</p><p className="text-xs text-muted">Requests, training plans and history</p></div>
        <ChevronRight size={19} className="shrink-0 text-muted" />
      </Link>

      <h2 className="text-sm font-semibold text-muted mb-2">Your profile</h2>
      <div className="card p-3 min-[360px]:p-4 flex flex-col gap-3">
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

      <h2 className="text-sm font-semibold text-muted mb-2 mt-6">Food search</h2>
      <div className="card p-3 min-[360px]:p-4 flex flex-col gap-3">
        <label>
          <span className="label">Preferred food region</span>
          <select
            className="input mt-1"
            value={t.foodRegion}
            onChange={(e) =>
              setT({ ...t, foodRegion: e.target.value as Targets["foodRegion"] })
            }
          >
            <option value="both">Portugal + Switzerland</option>
            <option value="PT">Portugal first</option>
            <option value="CH">Switzerland first</option>
          </select>
        </label>
        <label>
          <span className="label">Food names</span>
          <select
            className="input mt-1"
            value={t.foodLanguage}
            onChange={(e) =>
              setT({
                ...t,
                foodLanguage: e.target.value as Targets["foodLanguage"],
              })
            }
          >
            <option value="pt">Português</option>
            <option value="de">Deutsch</option>
            <option value="fr">Français</option>
            <option value="it">Italiano</option>
            <option value="en">English</option>
          </select>
        </label>
        <p className="text-[11px] text-muted">
          Official PortFIR and Swiss FSVO foods are ranked first for your region.
          USDA fills generic gaps; Open Food Facts supplies packaged products and barcodes.
        </p>
        <button onClick={save} className="btn-primary mt-1">
          {saved ? <><Check size={18} /> Saved</> : "Save food preferences"}
        </button>
      </div>

      <h2 className="text-sm font-semibold text-muted mb-2 mt-6">Goal</h2>
      <div className="card p-3 min-[360px]:p-4 flex flex-col gap-3">
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
        <label className="block w-full">
          <span className="label">Goal phase started</span>
          <input
            type="date"
            className="input mt-1"
            value={t.goalStartedOn ?? ""}
            onChange={(e) =>
              setT({ ...t, goalStartedOn: e.target.value || null })
            }
          />
          <span className="text-[11px] text-muted mt-1 block">
            Used to track cut duration and schedule evidence-based check-ins. Backdate it if your current phase already started.
          </span>
        </label>
        <label className="flex items-center justify-between gap-2 min-[360px]:gap-3">
          <span className="min-w-0 flex-1">
            <span className="font-medium block">Weekly weight change</span>
            <span className="text-xs text-muted">Percent of bodyweight</span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <input type="number" step={0.05} className="w-20 min-[360px]:w-24 input text-right"
              value={t.targetWeeklyChangePct}
              onChange={(e) => setT({ ...t, targetWeeklyChangePct: Number(e.target.value) })} />
            <span className="text-xs text-muted">%</span>
          </div>
        </label>
      </div>

      <h2 className="text-sm font-semibold text-muted mb-2 mt-6">Daily targets</h2>
      <div className="card p-3 min-[360px]:p-4 flex flex-col gap-3 mt-2">
        {fields.map((f) => (
          <label key={f.key} className="flex items-center justify-between gap-2 min-[360px]:gap-3">
            <span className="min-w-0 flex-1 font-medium">{f.label}</span>
            <div className="flex shrink-0 items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                className="w-20 min-[360px]:w-24 bg-surface-2 border border-border rounded-lg px-2 min-[360px]:px-3 py-2 text-right tabular-nums outline-none focus:border-accent"
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
          AI estimates calories from your profile and trends. Macros use a fixed formula based on body weight and goal. Nothing changes until you apply it.
        </p>
        {aiError && <p className="text-sm text-danger">{aiError}</p>}
        {recommendation && (
          <div className="bg-surface-2 border border-accent/30 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 font-semibold">Coach recommendation</p>
              <span className="shrink-0 text-[10px] uppercase text-muted">
                {recommendation.dataQuality} data
              </span>
            </div>
            <p className="text-lg font-bold text-accent mt-2">
              {recommendation.targetCalories} kcal
            </p>
            <p className="text-sm">
              {recommendation.targetProteinG}g protein · {recommendation.targetCarbsG}g carbs · {recommendation.targetFatG}g fat
            </p>
            <p className="text-xs text-muted mt-1">
              Protein {recommendation.proteinGPerKg.toFixed(1)} g/kg · Fat {recommendation.fatCaloriesPct}% of calories · Carbs use the remainder
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
      <div className="card p-3 min-[360px]:p-4 flex flex-col gap-3">
        {schedule.map((row) => (
          <label key={row.dayOfWeek} className="flex min-w-0 items-center gap-2 min-[360px]:gap-3">
            <span className="w-20 shrink-0 font-medium min-[400px]:w-24">{row.day}</span>
            <select className="input min-w-0 flex-1 py-2" value={row.routineId ?? ""}
              onChange={(e) => setSchedule((days) => days.map((d) => d.dayOfWeek === row.dayOfWeek ? { ...d, routineId: e.target.value ? Number(e.target.value) : null } : d))}>
              <option value="">Rest</option>
              {routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
        ))}
        <button onClick={save} className="btn-primary">Save schedule & settings</button>
      </div>

      <GarminSettings />

      <button onClick={logout} className="btn-ghost w-full mt-6">
        <LogOut size={18} /> Sign out
      </button>
      <p className="mt-4 text-center text-xs text-muted">
        <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/terms" className="underline underline-offset-2">Terms</Link>
      </p>
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
    <label className="flex items-center justify-between gap-2 min-[360px]:gap-3">
      <span className="min-w-0 flex-1">
        <span className="font-medium block">{label}</span>
        <span className="text-xs text-muted">{detail}</span>
      </span>
      <div className="flex shrink-0 items-center gap-1.5 min-[360px]:gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={step}
          className="w-20 min-[360px]:w-24 input text-right"
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
