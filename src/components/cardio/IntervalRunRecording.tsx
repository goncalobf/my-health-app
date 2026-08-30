"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { apiPost, apiPut } from "@/lib/api";
import { useLiveTimer, formatTime } from "@/lib/use-live-timer";
import { normalizeDecimalInput } from "@/lib/decimal-input";
import type { ActivitySession } from "@/db/schema";

interface IntervalLog {
  intervalNumber: number;
  targetDistanceM: number;
  actualDistanceM: number;
  durationSeconds: number;
  avgHeartRate: number | null;
}

export default function IntervalRunRecording({
  session,
  onDone,
}: {
  session: ActivitySession;
  onDone: () => void;
}) {
  // Setup phase
  const [setup, setSetup] = useState(true);
  const [numIntervals, setNumIntervals] = useState("6");
  const [targetDist, setTargetDist] = useState("400");

  // Active phase
  const [currentInterval, setCurrentInterval] = useState(1);
  const [logs, setLogs] = useState<IntervalLog[]>([]);
  const [running, setRunning] = useState(false);
  const { elapsed, reset } = useLiveTimer(running);
  const [confirming, setConfirming] = useState(false);
  const [actualDist, setActualDist] = useState("");
  const [hr, setHr] = useState("");
  const [saving, setSaving] = useState(false);

  const total = parseInt(numIntervals, 10) || 0;
  const target = parseFloat(normalizeDecimalInput(targetDist)) || 0;

  function beginWorkout() {
    if (total < 1 || target < 1) return;
    setSetup(false);
    setRunning(true);
  }

  function completeInterval() {
    setRunning(false);
    setConfirming(true);
    setActualDist(String(target));
  }

  async function confirmInterval() {
    const actual = parseFloat(normalizeDecimalInput(actualDist)) || target;
    const heartRate = hr ? parseInt(hr, 10) || null : null;
    const log: IntervalLog = {
      intervalNumber: currentInterval,
      targetDistanceM: target,
      actualDistanceM: actual,
      durationSeconds: elapsed,
      avgHeartRate: heartRate,
    };

    await apiPost(`/api/cardio-sessions/${session.id}/intervals`, {
      intervalNumber: log.intervalNumber,
      targetDistanceM: log.targetDistanceM,
      actualDistanceM: log.actualDistanceM,
      durationSeconds: log.durationSeconds,
      avgHeartRate: log.avgHeartRate,
    });

    const newLogs = [...logs, log];
    setLogs(newLogs);
    setConfirming(false);
    setHr("");

    if (currentInterval >= total) {
      // All intervals done — finish
      setSaving(true);
      const totalDuration = newLogs.reduce((s, l) => s + l.durationSeconds, 0);
      const totalDist = newLogs.reduce((s, l) => s + l.actualDistanceM, 0);
      await apiPut(`/api/cardio-sessions/${session.id}`, {
        finishedAt: new Date().toISOString(),
        durationSeconds: totalDuration,
        distanceM: totalDist,
      });
      onDone();
    } else {
      setCurrentInterval((n) => n + 1);
      reset();
      setRunning(true);
    }
  }

  if (setup) {
    return (
      <div className="flex min-h-[80dvh] flex-col justify-center gap-6 pb-6">
        <h1 className="font-display text-3xl tracking-[0.04em]">Interval run</h1>

        <div className="card flex flex-col gap-4 p-5">
          <label>
            <span className="label">Number of intervals</span>
            <input
              className="input mt-1"
              inputMode="numeric"
              placeholder="e.g. 8"
              value={numIntervals}
              onChange={(e) => setNumIntervals(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label>
            <span className="label">Target distance per interval (m)</span>
            <input
              className="input mt-1"
              inputMode="decimal"
              placeholder="e.g. 400"
              value={targetDist}
              onChange={(e) => setTargetDist(normalizeDecimalInput(e.target.value))}
            />
          </label>
          <button
            onClick={beginWorkout}
            disabled={total < 1 || target < 1}
            className="btn-primary mt-1"
          >
            Start intervals
          </button>
        </div>
      </div>
    );
  }

  if (confirming) {
    const paceSecPerKm = elapsed / ((target || 1) / 1000);
    const paceStr = `${Math.floor(paceSecPerKm / 60)}:${String(Math.round(paceSecPerKm % 60)).padStart(2, "0")} /km`;
    return (
      <div className="flex min-h-[80dvh] flex-col justify-center gap-6 pb-6">
        <div className="card p-5 text-center">
          <p className="label mb-1">Interval {currentInterval} / {total}</p>
          <p className="font-display text-5xl tabular-nums tracking-[0.06em]">{formatTime(elapsed)}</p>
          <p className="mt-1 text-sm text-muted">{paceStr}</p>
        </div>
        <div className="card flex flex-col gap-4 p-5">
          <label>
            <span className="label">Actual distance (m)</span>
            <input
              className="input mt-1"
              inputMode="decimal"
              value={actualDist}
              onChange={(e) => setActualDist(normalizeDecimalInput(e.target.value))}
            />
          </label>
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
          <button onClick={confirmInterval} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : currentInterval >= total ? "Finish" : "Next interval"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p className="label mb-1">Interval {currentInterval} / {total}</p>
        <p className="text-sm text-muted mb-4">Target: {target >= 1000 ? `${target / 1000} km` : `${target} m`}</p>
        <p className="font-display text-[5rem] tabular-nums leading-none tracking-[0.04em]">
          {formatTime(elapsed)}
        </p>
      </div>

      {logs.length > 0 && (
        <div className="w-full max-w-xs space-y-1">
          {logs.map((l) => (
            <div key={l.intervalNumber} className="flex items-center gap-3 text-sm text-muted">
              <CheckCircle size={14} className="text-accent shrink-0" />
              <span>#{l.intervalNumber}</span>
              <span className="tabular-nums">{formatTime(l.durationSeconds)}</span>
              <span>{l.actualDistanceM}m</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={completeInterval}
        className="btn-primary flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-full"
      >
        <CheckCircle size={28} />
        <span className="text-[10px] uppercase tracking-[0.14em]">Done</span>
      </button>

      <button
        onClick={() => {
          setRunning(false);
          setConfirming(true);
        }}
        className="text-xs text-muted underline underline-offset-2"
      >
        End early
      </button>
    </div>
  );
}
