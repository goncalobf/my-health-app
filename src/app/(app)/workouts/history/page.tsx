"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, History, Download, RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { formatDate } from "@/lib/utils";
import GarminImportModal from "@/components/GarminImportModal";

interface SessionRow {
  id: number;
  name: string;
  startedAt: string;
  finishedAt: string | null;
  kind: "resistance";
}

interface CardioRow {
  id: number;
  type: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  distanceM: number | null;
  kind: "cardio";
}

type AnyRow = SessionRow | CardioRow;

interface PendingImport {
  id: number;
  garminActivityId: string;
  garminActivityType: string;
  garminDataJson: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  run_easy: "Easy run",
  run_interval: "Interval run",
  indoor_cycling: "Indoor cycling",
  outdoor_cycling: "Outdoor cycling",
  hyrox: "Hyrox",
};

const TYPE_BADGE: Record<string, string> = {
  run_easy: "Run",
  run_interval: "Intervals",
  indoor_cycling: "Cycling",
  outdoor_cycling: "Cycling",
  hyrox: "Hyrox",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function HistoryPage() {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [pending, setPending] = useState<PendingImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importTarget, setImportTarget] = useState<PendingImport | null>(null);

  async function load() {
    const [sessions, cardio, imports] = await Promise.all([
      apiGet<Omit<SessionRow, "kind">[]>("/api/sessions"),
      apiGet<Omit<CardioRow, "kind">[]>("/api/cardio-sessions"),
      apiGet<PendingImport[]>("/api/garmin/pending").catch(() => []),
    ]);
    const combined: AnyRow[] = [
      ...sessions.map((s) => ({ ...s, kind: "resistance" as const })),
      ...cardio.map((c) => ({ ...c, kind: "cardio" as const })),
    ].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
    setRows(combined);
    setPending(imports);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function syncGarmin() {
    setSyncing(true);
    try {
      await fetch("/api/garmin/sync", { method: "POST" });
      await load();
    } finally {
      setSyncing(false);
    }
  }

  function afterImport() {
    setImportTarget(null);
    load();
  }

  return (
    <div>
      <PageHeader title="History" back="/workouts" />

      {/* Garmin pending imports */}
      {pending.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted">
              Garmin imports · {pending.length} pending
            </h2>
            <button
              onClick={syncGarmin}
              disabled={syncing}
              className="flex items-center gap-1 text-xs text-accent"
            >
              <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
              Sync
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {pending.map((imp) => {
              const data = JSON.parse(imp.garminDataJson);
              return (
                <button
                  key={imp.id}
                  onClick={() => setImportTarget(imp)}
                  className="card flex items-center gap-3 p-4 text-left active:scale-[0.98] transition"
                >
                  <Download size={16} className="text-accent shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {data.activityName ?? imp.garminActivityType}
                    </p>
                    <p className="text-xs text-muted">
                      {data.startTimeLocal
                        ? formatDate(data.startTimeLocal.slice(0, 10))
                        : ""}
                      {" · "}
                      {imp.garminActivityType.replace(/_/g, " ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-accent border border-accent/30 rounded px-2 py-0.5">
                    Label
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card p-6 flex flex-col items-center text-center gap-3">
          <History className="text-muted" size={32} />
          <p className="text-muted text-sm">No workouts logged yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => {
            if (row.kind === "resistance") {
              return (
                <Link
                  key={`r-${row.id}`}
                  href={
                    row.finishedAt
                      ? `/workouts/session/${row.id}/summary`
                      : `/workouts/session/${row.id}`
                  }
                  className="card p-4 flex items-center justify-between active:scale-[0.98] transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted border border-border rounded px-1.5 py-0.5">
                        Strength
                      </span>
                    </div>
                    <p className="break-words font-semibold">{row.name}</p>
                    <p className="text-xs text-muted">
                      {formatDate(new Date(row.startedAt).toISOString().slice(0, 10))}
                      {!row.finishedAt && (
                        <span className="text-accent"> · in progress</span>
                      )}
                    </p>
                  </div>
                  <ChevronRight className="shrink-0 text-muted" size={20} />
                </Link>
              );
            }

            const cardio = row as CardioRow;
            const distKm = cardio.distanceM ? (cardio.distanceM / 1000).toFixed(2) : null;
            return (
              <Link
                key={`c-${cardio.id}`}
                href={`/workouts/cardio/${cardio.id}/summary`}
                className="card p-4 flex items-center justify-between active:scale-[0.98] transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-accent border border-accent/30 rounded px-1.5 py-0.5">
                      {TYPE_BADGE[cardio.type] ?? cardio.type}
                    </span>
                  </div>
                  <p className="break-words font-semibold">
                    {TYPE_LABELS[cardio.type] ?? cardio.type}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(new Date(cardio.startedAt).toISOString().slice(0, 10))}
                    {cardio.durationSeconds && ` · ${formatDuration(cardio.durationSeconds)}`}
                    {distKm && ` · ${distKm} km`}
                  </p>
                </div>
                <ChevronRight className="shrink-0 text-muted" size={20} />
              </Link>
            );
          })}
        </div>
      )}

      {importTarget && (
        <GarminImportModal
          pending={importTarget}
          onClose={() => setImportTarget(null)}
          onImported={afterImport}
        />
      )}
    </div>
  );
}
