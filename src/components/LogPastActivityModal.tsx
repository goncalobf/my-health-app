"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Footprints, Repeat, Bike, Zap, Activity, ChevronDown } from "lucide-react";
import { apiPost } from "@/lib/api";
import { normalizeDecimalInput, parseDecimalInput } from "@/lib/decimal-input";
import { JIU_JITSU, jiuJitsuEfforts, type JiuJitsuEffort } from "@/lib/jiu-jitsu";
import { todayISO } from "@/lib/utils";

const TYPES = [
  { type: "run_easy", label: "Easy run", Icon: Footprints },
  { type: "run_interval", label: "Interval run", Icon: Repeat },
  { type: "indoor_cycling", label: "Indoor cycling", Icon: Bike },
  { type: "outdoor_cycling", label: "Outdoor cycling", Icon: Bike },
  { type: "hyrox", label: "Hyrox", Icon: Zap },
  { type: JIU_JITSU, label: "Jiu-jitsu", Icon: Activity },
] as const;

/** For an activity that already happened — no live tracking, just the stats
 *  entered directly and saved as an already-finished session. */
type ActivityType = (typeof TYPES)[number]["type"];

export default function LogPastActivityModal({ onClose, initialType }: {
  onClose: () => void;
  initialType?: ActivityType;
}) {
  const router = useRouter();
  const titleId = useId();
  const [type, setType] = useState<ActivityType | null>(initialType ?? null);
  const [day, setDay] = useState(todayISO());
  const [minutes, setMinutes] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [calories, setCalories] = useState("");
  const [effort, setEffort] = useState<JiuJitsuEffort | "">("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isJiuJitsu = type === JIU_JITSU;

  async function save() {
    if (!type) return;
    setSaving(true);
    setError("");
    try {
      const durationSeconds = minutes ? Math.round(Number(minutes) * 60) : null;
      const details = { durationSeconds, notes: notes.trim() || null };
      let session: { id: number };
      if (isJiuJitsu) {
        session = await apiPost("/api/cardio-sessions", { type, day, effort: effort || null, ...details });
      } else {
        const startedAt = new Date(`${day}T12:00:00`);
        const finishedAt = new Date(startedAt.getTime() + (durationSeconds ?? 0) * 1000);
        session = await apiPost("/api/cardio-sessions", {
          type,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          distanceM: distanceKm ? Math.round(parseDecimalInput(distanceKm) * 1000) : null,
          calories: calories ? Number(calories) : null,
          ...details,
        });
      }
      router.push(`/workouts/cardio/${session.id}/summary`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log this activity.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="card mx-auto flex max-h-[88vh] w-full max-w-xl flex-col rounded-b-none pb-safe">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <span id={titleId} className="font-display text-lg uppercase tracking-[0.08em]">{initialType === JIU_JITSU ? "Log jiu-jitsu" : "Log a past activity"}</span>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center text-muted" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!initialType && (
            <>
              <p className="label mb-2">Type</p>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {TYPES.map(({ type: t, label, Icon }) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    aria-pressed={type === t}
                    disabled={saving}
                    className={`flex items-center gap-2 p-3 text-left transition active:scale-95 rounded-xl ${
                      type === t ? "bg-accent text-bg" : "border border-border bg-surface-2 text-text"
                    }`}
                  >
                    <Icon size={17} />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <label className="mb-3 block">
            <p className="label mb-1">Date</p>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} max={todayISO()} className="input" />
          </label>

          <div className="mb-3 grid grid-cols-2 gap-3">
            <label className="block">
              <p className="label mb-1">{isJiuJitsu ? "Minutes (optional)" : "Duration (min)"}</p>
              <input
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                className="input"
              />
            </label>
            {isJiuJitsu ? (
              <label className="block">
                <span className="label mb-1 block">Effort (optional)</span>
                <div className="relative">
                  <select
                    className="input pr-10 capitalize"
                    value={effort}
                    onChange={(e) => setEffort(jiuJitsuEfforts.find((level) => level === e.target.value) ?? "")}
                  >
                    <option value="">Choose effort</option>
                    {jiuJitsuEfforts.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                  <ChevronDown aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                </div>
              </label>
            ) : (
              <label className="block">
                <p className="label mb-1">Distance (km)</p>
                <input
                  inputMode="decimal"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(normalizeDecimalInput(e.target.value))}
                  placeholder="0"
                  className="input"
                />
              </label>
            )}
          </div>

          {isJiuJitsu ? (
            <p className="mb-3 text-xs text-muted">Duration and effort help Coach account for mat time. No calorie estimate is needed.</p>
          ) : (
            <label className="mb-3 block">
              <p className="label mb-1">Calories (optional)</p>
              <input
                inputMode="numeric"
                value={calories}
                onChange={(e) => setCalories(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="0"
                className="input"
              />
            </label>
          )}

          <label className="mb-3 block">
            <p className="label mb-1">Notes (optional)</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              className="input resize-none"
            />
          </label>

          {error && <p role="alert" className="mb-2 text-xs text-danger">{error}</p>}

          <button onClick={save} disabled={!type || !day || saving} className="btn-primary w-full">
            {saving ? "Saving…" : "Save activity"}
          </button>
        </div>
      </div>
    </div>
  );
}
