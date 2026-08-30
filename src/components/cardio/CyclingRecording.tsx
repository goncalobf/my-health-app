"use client";

import { useState } from "react";
import { Square } from "lucide-react";
import { apiPut } from "@/lib/api";
import { useLiveTimer, formatTime } from "@/lib/use-live-timer";
import { normalizeDecimalInput } from "@/lib/decimal-input";
import type { ActivitySession } from "@/db/schema";

export default function CyclingRecording({
  session,
  onDone,
}: {
  session: ActivitySession;
  onDone: () => void;
}) {
  const isOutdoor = session.type === "outdoor_cycling";
  const [running, setRunning] = useState(true);
  const { elapsed } = useLiveTimer(running);
  const [finishing, setFinishing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dist, setDist] = useState("");
  const [elev, setElev] = useState("");
  const [hr, setHr] = useState("");
  const [notes, setNotes] = useState("");

  function stop() {
    setRunning(false);
    setFinishing(true);
  }

  async function save() {
    setSaving(true);
    const distKm = dist ? parseFloat(normalizeDecimalInput(dist)) : null;
    const distanceM = distKm && isFinite(distKm) ? distKm * 1000 : null;
    const elevationM = elev ? parseFloat(normalizeDecimalInput(elev)) || null : null;
    const avgHeartRate = hr ? parseInt(hr, 10) || null : null;
    const avgSpeedKmh =
      distKm && elapsed > 0 ? Math.round((distKm / (elapsed / 3600)) * 10) / 10 : null;
    await apiPut(`/api/cardio-sessions/${session.id}`, {
      finishedAt: new Date().toISOString(),
      durationSeconds: elapsed,
      distanceM,
      elevationM,
      avgHeartRate,
      avgSpeedKmh,
      notes: notes.trim() || null,
    });
    onDone();
  }

  const label = isOutdoor ? "Outdoor cycling" : "Indoor cycling";

  if (finishing) {
    return (
      <div className="flex min-h-[80dvh] flex-col gap-5 pb-6">
        <div className="card p-5 text-center">
          <p className="label mb-1">Total time</p>
          <p className="font-display text-5xl tabular-nums tracking-[0.06em]">
            {formatTime(elapsed)}
          </p>
        </div>

        <div className="card flex flex-col gap-4 p-5">
          <h2 className="label">Log your ride</h2>

          {isOutdoor && (
            <>
              <label>
                <span className="label">Distance (km)</span>
                <input
                  className="input mt-1"
                  inputMode="decimal"
                  placeholder="e.g. 45"
                  value={dist}
                  onChange={(e) => setDist(normalizeDecimalInput(e.target.value))}
                />
              </label>
              <label>
                <span className="label">Elevation gain (m)</span>
                <input
                  className="input mt-1"
                  inputMode="decimal"
                  placeholder="e.g. 800"
                  value={elev}
                  onChange={(e) => setElev(normalizeDecimalInput(e.target.value))}
                />
              </label>
            </>
          )}

          <label>
            <span className="label">Avg heart rate (bpm)</span>
            <input
              className="input mt-1"
              inputMode="numeric"
              placeholder="e.g. 155"
              value={hr}
              onChange={(e) => setHr(e.target.value.replace(/\D/g, ""))}
            />
          </label>

          <label>
            <span className="label">Notes</span>
            <textarea
              className="input mt-1 resize-none"
              rows={2}
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <button onClick={save} disabled={saving} className="btn-primary mt-1">
            {saving ? "Saving…" : "Save ride"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-8">
      <div className="text-center">
        <p className="label mb-2">{label} · in progress</p>
        <p className="font-display text-[5rem] tabular-nums leading-none tracking-[0.04em]">
          {formatTime(elapsed)}
        </p>
      </div>

      <button
        onClick={stop}
        className="btn-danger flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full"
      >
        <Square size={28} fill="currentColor" />
        <span className="text-[10px] uppercase tracking-[0.14em]">Stop</span>
      </button>
    </div>
  );
}
