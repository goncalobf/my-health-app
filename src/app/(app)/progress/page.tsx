"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Plus, Trophy, ChevronDown } from "lucide-react";
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

  async function load() {
    const [p, b] = await Promise.all([
      apiGet<PR[]>("/api/progress/prs"),
      apiGet<BW[]>("/api/bodyweight"),
    ]);
    setPrs(p);
    setBw(b);
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

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-muted mb-2">Bodyweight</h2>
        <div className="card p-4">
          <Chart
            data={bw.map((b) => ({ date: b.day, weightKg: b.weightKg }))}
            dataKey="weightKg"
            color="#22d3a6"
          />
          <form onSubmit={logWeight} className="flex gap-2 mt-3">
            <input
              type="number"
              inputMode="decimal"
              step={0.1}
              placeholder="Today's weight (kg)"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="input flex-1"
            />
            <button className="btn-primary" disabled={!weightInput}>
              <Plus size={18} /> Log
            </button>
          </form>
        </div>
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
                  <span className="text-lg font-bold tabular-nums text-accent">
                    {pr.est1RM}
                    <span className="text-xs text-muted font-normal">kg</span>
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-muted transition ${
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
