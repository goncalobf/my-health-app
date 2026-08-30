"use client";

import { useState } from "react";
import { X, Download } from "lucide-react";
import { formatTime } from "@/lib/use-live-timer";

interface PendingImport {
  id: number;
  garminActivityId: string;
  garminActivityType: string;
  garminDataJson: string;
}

const LABEL_OPTIONS = [
  { type: "run_easy", label: "Easy run" },
  { type: "run_interval", label: "Interval run" },
  { type: "indoor_cycling", label: "Indoor cycling" },
  { type: "outdoor_cycling", label: "Outdoor cycling" },
  { type: "hyrox", label: "Hyrox" },
];

export default function GarminImportModal({
  pending,
  onClose,
  onImported,
}: {
  pending: PendingImport;
  onClose: () => void;
  onImported: () => void;
}) {
  const [selectedType, setSelectedType] = useState("");
  const [division, setDivision] = useState("open");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const data = JSON.parse(pending.garminDataJson);
  const distKm = data.distance ? (data.distance / 1000).toFixed(2) : null;
  const duration = data.duration ? formatTime(Math.round(data.duration)) : null;

  async function importActivity() {
    if (!selectedType) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/garmin/import/${pending.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          division: selectedType === "hyrox" ? division : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error ?? "Import failed");
        return;
      }
      onImported();
    } catch {
      setError("Import failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card mx-auto w-full max-w-xl rounded-b-none pb-safe">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="label">Import from Garmin</p>
            <p className="mt-0.5 truncate font-semibold">
              {data.activityName ?? pending.garminActivityType}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center text-muted"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          {/* Garmin data summary */}
          <div className="flex gap-3 text-sm text-muted flex-wrap">
            {duration && <span>{duration}</span>}
            {distKm && <span>{distKm} km</span>}
            {data.averageHR && <span>{data.averageHR} bpm avg</span>}
            {data.calories && <span>{data.calories} kcal</span>}
          </div>

          <div>
            <p className="label mb-2">Label as</p>
            <div className="flex flex-col gap-2">
              {LABEL_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => setSelectedType(opt.type)}
                  className={`card flex items-center gap-3 p-3 text-left transition ${
                    selectedType === opt.type
                      ? "border-accent/60 bg-accent/5"
                      : "active:scale-[0.98]"
                  }`}
                >
                  <div
                    className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                      selectedType === opt.type
                        ? "border-accent bg-accent"
                        : "border-border"
                    }`}
                  />
                  <span className="font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedType === "hyrox" && (
            <label>
              <span className="label">Division</span>
              <select
                className="input mt-1"
                value={division}
                onChange={(e) => setDivision(e.target.value)}
              >
                {["open", "pro", "elite_15", "women", "doubles", "relay"].map((d) => (
                  <option key={d} value={d}>
                    {d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <p className="rounded bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
          )}

          <button
            onClick={importActivity}
            disabled={!selectedType || saving}
            className="btn-primary"
          >
            <Download size={16} />
            {saving ? "Importing…" : "Import activity"}
          </button>
        </div>
      </div>
    </div>
  );
}
