"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, ChevronRight, Sparkles } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import CoachInsightCard, { CoachInsightRow } from "@/components/CoachInsightCard";

export default function CoachDashboardCard({ day }: { day: string }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [row, setRow] = useState<CoachInsightRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ configured: boolean; insights: CoachInsightRow[] }>("/api/coach/insights?kind=daily")
      .then((data) => {
        setConfigured(data.configured);
        setRow(data.insights.find((insight) => insight.sourceKey === `daily:${day}`) ?? null);
      })
      .catch(() => setConfigured(false));
  }, [day]);

  async function generate() {
    setLoading(true); setError("");
    try { setRow(await apiPost<CoachInsightRow>("/api/coach/insights", { kind: "daily", refresh: true })); }
    catch (e) { setError(e instanceof Error ? e.message : "Coach unavailable"); }
    finally { setLoading(false); }
  }

  if (configured === null) return null;
  if (!configured) return (
    <Link href="/coach" className="card p-4 flex items-center gap-3 border-accent/30">
      <div className="icon-frame"><Brain size={20} /></div>
      <div className="min-w-0 flex-1"><p className="font-display text-xl tracking-[0.04em]">Fitlog Coach</p><p className="text-xs text-muted">Coach is currently unavailable</p></div><ChevronRight size={19} className="shrink-0 text-muted" />
    </Link>
  );
  if (row) return (
    <div>
      <CoachInsightCard row={row} compact />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={generate} disabled={loading} className="btn-ghost">
          {loading ? "Reviewing…" : "Refresh guidance"}
        </button>
        <Link href="/coach" className="inline-flex min-h-11 items-center gap-1 text-sm text-accent">
          Open Coach <ChevronRight size={15} aria-hidden="true" />
        </Link>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
  return (
    <div className="card p-4 text-center">
      <Sparkles size={24} className="text-accent mx-auto" /><p className="mt-2 font-display text-2xl tracking-[0.04em]">What stands out today?</p>
      <p className="text-xs text-muted mt-1">Coach can review your sleep, training and other recent Fitlog data.</p>
      <button onClick={generate} disabled={loading} className="btn-primary w-full mt-3">{loading ? "Reviewing…" : "Get today’s guidance"}</button>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </div>
  );
}
