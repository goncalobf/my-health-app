"use client";

import Link from "next/link";
import { ChevronDown, RefreshCw, Watch } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { GarminDailyMetrics } from "@/db/schema";
import { api } from "@/lib/api";
import { formatSleepDuration } from "@/lib/garmin-sleep";
import { dateISOInTimeZone, formatDate } from "@/lib/utils";

type GarminDay = Pick<GarminDailyMetrics,
  "date" | "steps" | "caloriesActive" | "caloriesTotal" | "restingHrBpm" | "hrvScore" | "sleepDurationSeconds" | "sleepScoreValue"
>;

interface GarminHealthData {
  connection: { connected: boolean; lastSyncedAt: string | null };
  days: GarminDay[];
}

function displayNumber(value: number | null, unit = "") {
  if (value === null) return null;
  return unit ? `${value.toLocaleString()} ${unit}` : value.toLocaleString();
}

function readings(day: GarminDay) {
  return [
    { label: "Steps", value: displayNumber(day.steps) },
    { label: "Total energy", value: displayNumber(day.caloriesTotal, "kcal") },
    { label: "Active energy", value: displayNumber(day.caloriesActive, "kcal") },
    { label: "Resting heart rate", value: displayNumber(day.restingHrBpm, "bpm") },
    { label: "Overnight HRV", value: displayNumber(day.hrvScore, "ms") },
    { label: "Sleep duration", value: formatSleepDuration(day.sleepDurationSeconds) },
    { label: "Sleep score", value: displayNumber(day.sleepScoreValue, "/ 100") },
  ].filter(({ value }) => value !== null);
}

export default function GarminHealth() {
  const [data, setData] = useState<GarminHealthData | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncResult, setSyncResult] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [connection, days] = await Promise.all([
        api<GarminHealthData["connection"]>("/api/garmin/connect", { signal }),
        api<GarminDay[]>("/api/garmin/daily-metrics?days=7", { signal }),
      ]);
      if (signal?.aborted) return;
      setData({ connection, days });
      setLoadError(false);
    } catch {
      if (!signal?.aborted) setLoadError(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function sync() {
    setSyncing(true);
    setSyncError("");
    setSyncResult("");
    try {
      const { imported } = await api<{ imported: number }>("/api/garmin/sync", { method: "POST" });
      setSelectedDate("");
      setSyncResult(imported
        ? `${imported} new ${imported === 1 ? "activity" : "activities"} ready to review.`
        : "Sync complete.");
      await load();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Garmin sync failed. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  const day = data?.days.find(({ date }) => date === selectedDate) ?? data?.days[0];
  const metrics = day ? readings(day) : [];
  const connection = data?.connection;
  const lastSync = connection?.lastSyncedAt
    ? formatDate(dateISOInTimeZone(new Date(connection.lastSyncedAt)))
    : null;

  return (
    <section className="card space-y-4 p-4 min-[375px]:p-5" aria-labelledby="garmin-health-heading">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="icon-frame shrink-0"><Watch size={18} aria-hidden="true" /></span>
          <div>
            <h2 id="garmin-health-heading" className="text-base font-extrabold">Garmin health</h2>
            {lastSync && <p className="text-xs text-muted">Last synced {lastSync}</p>}
          </div>
        </div>
        {connection?.connected ? (
          <button type="button" onClick={sync} disabled={syncing} className="btn-ghost">
            <RefreshCw size={15} aria-hidden="true" className={syncing ? "animate-spin" : undefined} />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        ) : data && (
          <Link href="/settings#connections" className="btn-ghost">Connect Garmin</Link>
        )}
      </header>

      {loadError && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-danger" role="alert">
          <p>Could not load Garmin data.</p>
          <button type="button" onClick={() => { setLoadError(false); void load(); }} className="btn-ghost">Retry loading</button>
        </div>
      )}
      {syncError && <p className="text-sm text-danger" role="alert">{syncError}</p>}
      {syncResult && <p className="text-sm text-accent" role="status">{syncResult}</p>}

      {!data && !loadError && <p className="text-sm text-muted" role="status">Loading Garmin data…</p>}
      {!day && connection && (
        <p className="text-sm text-muted">
          {connection.connected
            ? lastSync
              ? "Garmin has shared no daily health metrics in the last seven days yet."
              : "Sync Garmin to see your steps, energy, sleep and recovery metrics."
            : "Connect Garmin to see your daily health metrics here."}
        </p>
      )}

      {day && (
        <>
          {data && data.days.length > 1 ? (
            <label className="block max-w-xs">
              <span className="label">Recorded day</span>
              <span className="relative mt-1 block">
                <select className="input pr-10" value={day.date} onChange={(event) => setSelectedDate(event.target.value)}>
                  {data.days.map(({ date }) => <option key={date} value={date}>{formatDate(date)}</option>)}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              </span>
            </label>
          ) : (
            <time className="block text-sm font-semibold text-muted" dateTime={day.date}>{formatDate(day.date)}</time>
          )}
          {metrics.length ? (
            <dl className="grid grid-cols-2 gap-2 min-[650px]:grid-cols-3">
              {metrics.map(({ label, value }) => (
                <div key={label} className="min-w-0 rounded-xl border border-border bg-surface-2 p-3">
                  <dt className="text-xs font-semibold text-muted">{label}</dt>
                  <dd className="mt-1 text-base font-bold tabular-nums text-text">{value}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="text-sm text-muted">Garmin shared no health metrics for this day.</p>}
        </>
      )}

      {(connection?.connected || day) && (
        <Link href="/workouts/history" className="inline-flex min-h-11 items-center text-sm font-bold text-accent hover:underline">
          Review Garmin activities
        </Link>
      )}
    </section>
  );
}
