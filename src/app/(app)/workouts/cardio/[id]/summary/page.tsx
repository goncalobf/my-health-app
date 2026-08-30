"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, Home } from "lucide-react";
import { apiGet } from "@/lib/api";
import { formatTime } from "@/lib/use-live-timer";
import type { ActivitySession, ActivityInterval, HyroxSegment } from "@/db/schema";

interface FullSession extends ActivitySession {
  intervals: ActivityInterval[];
  segments: HyroxSegment[];
}

const STATION_LABELS: Record<string, string> = {
  ski_erg: "SkiErg",
  sled_push: "Sled Push",
  sled_pull: "Sled Pull",
  burpee_broad_jump: "Burpee Broad Jump",
  rowing: "Rowing",
  farmers_carry: "Farmers Carry",
  sandbag_lunges: "Sandbag Lunges",
  wall_balls: "Wall Balls",
};

const TYPE_LABELS: Record<string, string> = {
  run_easy: "Easy run",
  run_interval: "Interval run",
  indoor_cycling: "Indoor cycling",
  outdoor_cycling: "Outdoor cycling",
  hyrox: "Hyrox",
};

export default function CardioSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [session, setSession] = useState<FullSession | null>(null);

  useEffect(() => {
    apiGet<FullSession>(`/api/cardio-sessions/${id}`).then(setSession);
  }, [id]);

  if (!session) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center text-muted text-sm">
        Loading…
      </div>
    );
  }

  const distKm = session.distanceM ? session.distanceM / 1000 : null;
  const paceSecPerKm =
    distKm && session.durationSeconds ? session.durationSeconds / distKm : null;
  const paceStr = paceSecPerKm
    ? `${Math.floor(paceSecPerKm / 60)}:${String(Math.round(paceSecPerKm % 60)).padStart(2, "0")} /km`
    : null;

  const runSegments = session.segments.filter((s) => s.segmentType === "run");
  const stationSegments = session.segments.filter((s) => s.segmentType === "station");

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div className="text-center py-6">
        <CheckCircle size={40} className="mx-auto mb-3 text-accent" />
        <h1 className="font-display text-4xl tracking-[0.04em]">
          {TYPE_LABELS[session.type] ?? session.type}
        </h1>
        <p className="mt-1 text-sm text-muted">Complete</p>
      </div>

      {/* Key stats */}
      <div className="card grid grid-cols-2 divide-x divide-border p-0 overflow-hidden">
        <div className="p-4 text-center">
          <p className="label mb-1">Duration</p>
          <p className="font-display text-3xl tabular-nums">
            {session.durationSeconds ? formatTime(session.durationSeconds) : "—"}
          </p>
        </div>
        {distKm ? (
          <div className="p-4 text-center">
            <p className="label mb-1">Distance</p>
            <p className="font-display text-3xl tabular-nums">{distKm.toFixed(2)} km</p>
          </div>
        ) : session.avgHeartRate ? (
          <div className="p-4 text-center">
            <p className="label mb-1">Avg HR</p>
            <p className="font-display text-3xl tabular-nums">{session.avgHeartRate} bpm</p>
          </div>
        ) : (
          <div className="p-4" />
        )}
      </div>

      {(paceStr || session.elevationM || session.avgHeartRate || session.calories) && (
        <div className="card grid grid-cols-2 gap-4 p-5">
          {paceStr && (
            <div>
              <p className="label">Avg pace</p>
              <p className="font-display text-xl tabular-nums mt-1">{paceStr}</p>
            </div>
          )}
          {session.elevationM && (
            <div>
              <p className="label">Elevation</p>
              <p className="font-display text-xl tabular-nums mt-1">{session.elevationM} m</p>
            </div>
          )}
          {session.avgHeartRate && (
            <div>
              <p className="label">Avg HR</p>
              <p className="font-display text-xl tabular-nums mt-1">{session.avgHeartRate} bpm</p>
            </div>
          )}
          {session.calories && (
            <div>
              <p className="label">Calories</p>
              <p className="font-display text-xl tabular-nums mt-1">{session.calories} kcal</p>
            </div>
          )}
        </div>
      )}

      {/* Interval splits */}
      {session.intervals.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-3">Intervals</h2>
          <div className="space-y-2">
            {session.intervals.map((iv) => {
              const pace =
                iv.actualDistanceM && iv.durationSeconds
                  ? iv.durationSeconds / (iv.actualDistanceM / 1000)
                  : null;
              const paceLabel = pace
                ? `${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, "0")} /km`
                : null;
              return (
                <div key={iv.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted">#{iv.intervalNumber}</span>
                  <span className="tabular-nums font-medium">
                    {iv.durationSeconds ? formatTime(iv.durationSeconds) : "—"}
                  </span>
                  {iv.actualDistanceM && (
                    <span className="text-muted">{iv.actualDistanceM}m</span>
                  )}
                  {paceLabel && <span className="text-muted">{paceLabel}</span>}
                  {iv.avgHeartRate && <span className="text-muted">{iv.avgHeartRate} bpm</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hyrox splits */}
      {session.type === "hyrox" && session.segments.length > 0 && (
        <>
          {session.division && (
            <p className="text-xs text-muted text-center uppercase tracking-widest">
              Division: {session.division.replace(/_/g, " ")}
              {session.location ? ` · ${session.location}` : ""}
            </p>
          )}
          <div className="card p-5">
            <h2 className="section-title mb-3">Station splits</h2>
            <div className="space-y-2">
              {Array.from({ length: 8 }, (_, i) => {
                const run = runSegments.find((s) => s.segmentNumber === i + 1);
                const station = stationSegments.find((s) => s.segmentNumber === i + 1);
                return (
                  <div key={i} className="flex flex-col gap-1 border-b border-border pb-2 last:border-0 last:pb-0">
                    {run && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted">Run {i + 1}</span>
                        <span className="tabular-nums">
                          {run.durationSeconds ? formatTime(run.durationSeconds) : "—"}
                        </span>
                      </div>
                    )}
                    {station && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {STATION_LABELS[station.stationName ?? ""] ?? station.stationName}
                        </span>
                        <span className="tabular-nums">
                          {station.durationSeconds ? formatTime(station.durationSeconds) : "—"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {session.notes && (
        <div className="card p-4">
          <p className="label mb-1">Notes</p>
          <p className="text-sm text-muted">{session.notes}</p>
        </div>
      )}

      <Link href="/workouts" className="btn-primary mt-2 justify-center">
        <Home size={18} /> Back to workouts
      </Link>
    </div>
  );
}
