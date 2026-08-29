"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Plus, Trophy, ChevronDown, Ruler, Camera, Gauge } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { formatDate, todayISO } from "@/lib/utils";

interface PR {
  exerciseId: number;
  name: string;
  bestWeightKg: number;
  bestReps: number;
  est1RM: number;
  date: string;
}
interface BW {
  id: number;
  day: string;
  weightKg: number;
}
interface ExPoint {
  date: string;
  est1RM: number;
  topWeightKg: number;
}
interface Measurement {
  id: number; day: string; waistCm: number | null; chestCm: number | null;
  armsCm: number | null; thighsCm: number | null; bodyFatPct: number | null;
  notes: string | null; photoDataUrl: string | null;
}

function Chart({
  data,
  dataKey,
  color,
}: {
  data: { date: string; [k: string]: number | string }[];
  dataKey: string;
  color: string;
}) {
  if (data.length < 2) {
    return (
      <p className="text-xs text-muted text-center py-6">
        Need at least two data points to plot a trend.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
        <XAxis
          dataKey="date"
          tick={{ fill: "#8a97a6", fontSize: 11 }}
          tickFormatter={(d) => formatDate(d).replace(/^\w+, /, "")}
          minTickGap={24}
          stroke="#26313d"
        />
        <YAxis
          tick={{ fill: "#8a97a6", fontSize: 11 }}
          stroke="#26313d"
          domain={["dataMin - 2", "dataMax + 2"]}
          width={40}
        />
        <Tooltip
          contentStyle={{
            background: "#131a22",
            border: "1px solid #26313d",
            borderRadius: 12,
            color: "#e6edf3",
          }}
          labelFormatter={(d) => formatDate(String(d))}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2.5}
          dot={{ r: 3, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function ProgressPage() {
  const [prs, setPrs] = useState<PR[]>([]);
  const [bw, setBw] = useState<BW[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [exData, setExData] = useState<Record<number, ExPoint[]>>({});
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [measure, setMeasure] = useState({ waistCm: "", chestCm: "", armsCm: "", thighsCm: "", bodyFatPct: "", notes: "", photoDataUrl: "" });
  const latestMeasurement = measurements[measurements.length - 1];
  const recentWeightAvg = bw.length ? bw.slice(-7).reduce((n, x) => n + x.weightKg, 0) / Math.min(7, bw.length) : null;

  async function load() {
    const [p, b, m] = await Promise.all([
      apiGet<PR[]>("/api/progress/prs"),
      apiGet<BW[]>("/api/bodyweight"),
      apiGet<Measurement[]>("/api/measurements"),
    ]);
    setPrs(p);
    setBw(b);
    setMeasurements(m);
  }

  async function logMeasurements(e: React.FormEvent) {
    e.preventDefault();
    await apiPost("/api/measurements", { ...measure, day: todayISO() });
    setMeasure({ waistCm: "", chestCm: "", armsCm: "", thighsCm: "", bodyFatPct: "", notes: "", photoDataUrl: "" });
    setMeasurements(await apiGet<Measurement[]>("/api/measurements"));
  }

  async function selectPhoto(file?: File) {
    if (!file) return;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 900 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    setMeasure((m) => ({ ...m, photoDataUrl: canvas.toDataURL("image/jpeg", 0.72) }));
  }
  useEffect(() => {
    load();
  }, []);

  async function logWeight(e: React.FormEvent) {
    e.preventDefault();
    const w = Number(weightInput);
    if (!w) return;
    await apiPost("/api/bodyweight", { weightKg: w, day: todayISO() });
    setWeightInput("");
    setBw(await apiGet<BW[]>("/api/bodyweight"));
  }

  async function toggleExercise(exerciseId: number) {
    if (expanded === exerciseId) {
      setExpanded(null);
      return;
    }
    setExpanded(exerciseId);
    if (!exData[exerciseId]) {
      const d = await apiGet<{ points: ExPoint[] }>(
        `/api/progress/exercise/${exerciseId}`
      );
      setExData((m) => ({ ...m, [exerciseId]: d.points }));
    }
  }

  return (
    <div>
      <PageHeader title="Progress" />

      <Link href="/workouts/plan" className="card mb-6 flex items-center gap-3 border-accent/30 p-4 active:scale-[0.98] transition">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><Gauge size={20} /></div>
        <div className="min-w-0 flex-1"><p className="font-semibold">Training progression</p><p className="text-xs text-muted">Mesocycle week, RIR and deload signals</p></div>
      </Link>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted mb-2">Bodyweight</h2>
        <div className="card min-w-0 p-3 min-[360px]:p-4">
          <Chart
            data={bw.map((b) => ({ date: b.day, weightKg: b.weightKg }))}
            dataKey="weightKg"
            color="#22d3a6"
          />
          {recentWeightAvg != null && <p className="text-xs text-muted text-center -mt-1 mb-2">Recent average: <span className="text-text font-semibold">{Math.round(recentWeightAvg * 10) / 10} kg</span></p>}
          <form onSubmit={logWeight} className="flex gap-2 mt-3">
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              placeholder="Today's weight (kg)"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="input min-w-0 flex-1"
            />
            <button className="btn-primary shrink-0" disabled={!weightInput}>
              <Plus size={18} /> Log
            </button>
          </form>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted mb-2">Measurements & photos</h2>
        <form onSubmit={logMeasurements} className="card p-3 min-[360px]:p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 min-[340px]:grid-cols-2">
            {([
              ["waistCm", "Waist (cm)"], ["chestCm", "Chest (cm)"],
              ["armsCm", "Arms (cm)"], ["thighsCm", "Thighs (cm)"],
              ["bodyFatPct", "Body fat (%)"],
            ] as const).map(([key, label]) => (
              <input key={key} type="number" inputMode="decimal" step={0.1} className="input" placeholder={label}
                value={measure[key]} onChange={(e) => setMeasure({ ...measure, [key]: e.target.value })} />
            ))}
          </div>
          <input className="input" placeholder="Notes (optional)" value={measure.notes} onChange={(e) => setMeasure({ ...measure, notes: e.target.value })} />
          <label className="btn-ghost cursor-pointer">
            <Camera size={18} /> {measure.photoDataUrl ? "Photo selected" : "Add progress photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => selectPhoto(e.target.files?.[0])} />
          </label>
          <button className="btn-primary" disabled={!measure.waistCm && !measure.chestCm && !measure.armsCm && !measure.thighsCm && !measure.bodyFatPct && !measure.photoDataUrl}>
            <Ruler size={18} /> Save check-in
          </button>
        </form>
        {latestMeasurement && (
          <div className="card p-4 mt-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-1"><p className="font-semibold">Latest check-in</p><span className="text-xs text-muted">{formatDate(latestMeasurement.day)}</span></div>
            <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
              {([['waistCm', 'Waist'], ['chestCm', 'Chest'], ['armsCm', 'Arms'], ['thighsCm', 'Thighs'], ['bodyFatPct', 'Body fat']] as const).map(([key, label]) => latestMeasurement[key] != null ? (
                <div key={key} className="bg-surface-2 rounded-xl p-2 text-center"><p className="font-bold tabular-nums">{latestMeasurement[key]}<span className="text-[10px] text-muted">{key === 'bodyFatPct' ? '%' : 'cm'}</span></p><p className="text-[10px] text-muted">{label}</p></div>
              ) : null)}
            </div>
          </div>
        )}
        {measurements.filter((m) => m.waistCm != null).length >= 2 && (
          <div className="card p-3 mt-3">
            <p className="text-xs text-muted mb-2">Waist trend</p>
            <Chart data={measurements.filter((m) => m.waistCm != null).map((m) => ({ date: m.day, waistCm: m.waistCm! }))} dataKey="waistCm" color="#f5a623" />
          </div>
        )}
        {measurements.some((m) => m.photoDataUrl) && (
          <div className="flex gap-2 overflow-x-auto mt-3">
            {measurements.filter((m) => m.photoDataUrl).slice(-8).map((m) => (
              <div key={m.id} className="shrink-0">
                {/* Private in-memory data URLs cannot benefit from image optimization. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.photoDataUrl!} alt={`Progress ${m.day}`} className="w-28 h-36 object-cover rounded-xl border border-border" />
                <p className="text-[11px] text-muted mt-1">{formatDate(m.day)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted mb-2">
          Personal records
        </h2>
        {prs.length === 0 ? (
          <div className="card p-6 flex flex-col items-center text-center gap-3">
            <Trophy className="text-muted" size={32} />
            <p className="text-muted text-sm">
              Complete some workouts and your PRs will show up here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {prs.map((pr) => (
              <div key={pr.exerciseId} className="card overflow-hidden">
                <button
                  onClick={() => toggleExercise(pr.exerciseId)}
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{pr.name}</p>
                    <p className="text-xs text-muted">
                      Best: {pr.bestWeightKg}kg × {pr.bestReps} · ~
                      {pr.est1RM}kg 1RM
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-bold tabular-nums text-accent">
                    {pr.est1RM}
                    <span className="text-xs text-muted font-normal">kg</span>
                  </span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-muted transition ${
                      expanded === pr.exerciseId ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {expanded === pr.exerciseId && (
                  <div className="px-2 pb-3 border-t border-border pt-2">
                    <Chart
                      data={(exData[pr.exerciseId] ?? []).map((p) => ({
                        date: p.date,
                        est1RM: p.est1RM,
                      }))}
                      dataKey="est1RM"
                      color="#22d3a6"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
