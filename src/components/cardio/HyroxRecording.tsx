"use client";

import { useState } from "react";
import { CheckCircle, Flag } from "lucide-react";
import { apiPost, apiPut } from "@/lib/api";
import { useLiveTimer, formatTime } from "@/lib/use-live-timer";
import { normalizeDecimalInput } from "@/lib/decimal-input";
import type { ActivitySession } from "@/db/schema";

const STATIONS = [
  { name: "ski_erg", label: "SkiErg", distance: "1,000m", defaultWeightOpen: null },
  { name: "sled_push", label: "Sled Push", distance: "50m", defaultWeightOpen: 152 },
  { name: "sled_pull", label: "Sled Pull", distance: "50m", defaultWeightOpen: 103 },
  { name: "burpee_broad_jump", label: "Burpee Broad Jump", distance: "80m", defaultWeightOpen: null },
  { name: "rowing", label: "Rowing", distance: "1,000m", defaultWeightOpen: null },
  { name: "farmers_carry", label: "Farmers Carry", distance: "200m", defaultWeightOpen: 48 },
  { name: "sandbag_lunges", label: "Sandbag Lunges", distance: "100m", defaultWeightOpen: 20 },
  { name: "wall_balls", label: "Wall Balls", distance: "100 reps", defaultWeightOpen: 6 },
] as const;

const DIVISIONS = ["open", "pro", "elite_15", "women", "doubles", "relay"];

interface SegmentLog {
  segmentNumber: number;
  segmentType: "run" | "station";
  stationName?: string;
  durationSeconds: number;
  avgHeartRate: number | null;
  weightKg: number | null;
}

export default function HyroxRecording({
  session,
  onDone,
}: {
  session: ActivitySession;
  onDone: () => void;
}) {
  const [setup, setSetup] = useState(true);
  const [division, setDivision] = useState("open");
  const [location, setLocation] = useState("");

  const [segmentIndex, setSegmentIndex] = useState(0); // 0–15
  const [logs, setLogs] = useState<SegmentLog[]>([]);
  const [running, setRunning] = useState(false);
  const { elapsed, reset } = useLiveTimer(running);
  const [confirming, setConfirming] = useState(false);
  const [weight, setWeight] = useState("");
  const [hr, setHr] = useState("");
  const [saving, setSaving] = useState(false);

  // Build the 16-segment sequence: run 1km → station → repeat
  const segments: Array<{ type: "run" | "station"; stationIndex?: number; label: string }> = [];
  for (let i = 0; i < 8; i++) {
    segments.push({ type: "run", label: `Run 1 km` });
    segments.push({ type: "station", stationIndex: i, label: STATIONS[i].label });
  }

  const current = segments[segmentIndex];
  const station = current.type === "station" ? STATIONS[current.stationIndex!] : null;

  function beginWorkout() {
    setSetup(false);
    setRunning(true);
    if (station?.defaultWeightOpen) setWeight(String(station.defaultWeightOpen));
  }

  function completeSegment() {
    setRunning(false);
    setConfirming(true);
    if (station?.defaultWeightOpen) setWeight(String(station.defaultWeightOpen));
  }

  async function confirmSegment() {
    setSaving(true);
    const segNum = Math.floor(segmentIndex / 2) + 1;
    const heartRate = hr ? parseInt(hr, 10) || null : null;
    const weightKg = weight ? parseFloat(normalizeDecimalInput(weight)) || null : null;
    const log: SegmentLog = {
      segmentNumber: segNum,
      segmentType: current.type,
      stationName: station?.name,
      durationSeconds: elapsed,
      avgHeartRate: heartRate,
      weightKg,
    };

    await apiPost(`/api/cardio-sessions/${session.id}/segments`, {
      segmentNumber: segNum,
      segmentType: current.type,
      stationName: station?.name ?? null,
      durationSeconds: elapsed,
      avgHeartRate: heartRate,
      weightKg,
    });

    const newLogs = [...logs, log];
    setLogs(newLogs);
    setSaving(false);
    setConfirming(false);
    setHr("");

    if (segmentIndex >= 15) {
      // All 16 segments done
      const totalDuration = newLogs.reduce((s, l) => s + l.durationSeconds, 0);
      await apiPut(`/api/cardio-sessions/${session.id}`, {
        finishedAt: new Date().toISOString(),
        durationSeconds: totalDuration,
        division,
        location: location.trim() || null,
      });
      onDone();
    } else {
      const nextIndex = segmentIndex + 1;
      setSegmentIndex(nextIndex);
      const nextSegment = segments[nextIndex];
      const nextStation =
        nextSegment.type === "station" ? STATIONS[nextSegment.stationIndex!] : null;
      if (nextStation?.defaultWeightOpen) {
        setWeight(String(nextStation.defaultWeightOpen));
      } else {
        setWeight("");
      }
      reset();
      setRunning(true);
    }
  }

  if (setup) {
    return (
      <div className="flex min-h-[80dvh] flex-col justify-center gap-6 pb-6">
        <h1 className="font-display text-3xl tracking-[0.04em]">Hyrox</h1>
        <div className="card flex flex-col gap-4 p-5">
          <label>
            <span className="label">Division</span>
            <select
              className="input mt-1"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
            >
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  {d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Location (optional)</span>
            <input
              className="input mt-1"
              placeholder="e.g. Berlin"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </label>
          <button onClick={beginWorkout} className="btn-primary mt-1">
            Start Hyrox
          </button>
        </div>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex min-h-[80dvh] flex-col justify-center gap-6 pb-6">
        <div className="card p-5 text-center">
          <p className="label mb-1">{current.label}</p>
          <p className="font-display text-5xl tabular-nums tracking-[0.06em]">{formatTime(elapsed)}</p>
        </div>
        <div className="card flex flex-col gap-4 p-5">
          <label>
            <span className="label">Avg heart rate (bpm)</span>
            <input
              className="input mt-1"
              inputMode="numeric"
              placeholder="optional"
              value={hr}
              onChange={(e) => setHr(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          {station && station.defaultWeightOpen !== null && (
            <label>
              <span className="label">Weight (kg)</span>
              <input
                className="input mt-1"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(normalizeDecimalInput(e.target.value))}
              />
            </label>
          )}
          <button onClick={confirmSegment} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : segmentIndex >= 15 ? "Finish Hyrox" : "Next segment"}
          </button>
        </div>
      </div>
    );
  }

  const runNumber = Math.floor(segmentIndex / 2) + 1;
  const completedRuns = logs.filter((l) => l.segmentType === "run").length;
  const completedStations = logs.filter((l) => l.segmentType === "station").length;

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p className="label mb-1">
          {current.type === "run"
            ? `Run ${runNumber} / 8 · 1 km`
            : `${current.label} · ${station?.distance}`}
        </p>
        <p className="font-display text-[5rem] tabular-nums leading-none tracking-[0.04em]">
          {formatTime(elapsed)}
        </p>
        <div className="mt-3 flex justify-center gap-4 text-xs text-muted">
          <span>{completedRuns}/8 runs</span>
          <span>{completedStations}/8 stations</span>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="w-full max-w-xs space-y-1">
          {logs.slice(-3).map((l, i) => (
            <div key={i} className="flex items-center gap-3 text-xs text-muted">
              <CheckCircle size={12} className="text-accent shrink-0" />
              <span className="flex-1 truncate">
                {l.segmentType === "run" ? `Run ${l.segmentNumber}` : STATIONS.find((s) => s.name === l.stationName)?.label}
              </span>
              <span className="tabular-nums">{formatTime(l.durationSeconds)}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={completeSegment}
        className="btn-primary flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full"
      >
        <Flag size={28} />
        <span className="text-[10px] uppercase tracking-[0.14em]">Done</span>
      </button>
    </div>
  );
}
