"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, ChevronRight, Sparkles } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import CoachInsightCard, { CoachInsightRow } from "@/components/CoachInsightCard";

export default function CoachDashboardCard() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [row, setRow] = useState<CoachInsightRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ configured: boolean; insights: CoachInsightRow[] }>("/api/coach/insights?kind=daily")
      .then((data) => { setConfigured(data.configured); setRow(data.insights[0] ?? null); })
      .catch(() => setConfigured(false));
  }, []);

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
      <div className="min-w-0 flex-1"><p className="font-display text-xl tracking-[0.04em]">Fitlog Coach</p><p className="text-xs text-muted">Add an API key to enable personal insights</p></div><ChevronRight size={19} className="shrink-0 text-muted" />
    </Link>
  );
  if (row) return <div><CoachInsightCard row={row} compact /><Link href="/coach" className="text-sm text-accent flex items-center justify-center gap-1 mt-2">Open Coach <ChevronRight size={15} /></Link></div>;
  return (
    <div className="card p-4 text-center">
      <Sparkles size={24} className="text-accent mx-auto" /><p className="mt-2 font-display text-2xl tracking-[0.04em]">What stands out today?</p>
      <p className="text-xs text-muted mt-1">Coach can review your recent training, nutrition, Garmin and weight data.</p>
      <button onClick={generate} disabled={loading} className="btn-primary w-full mt-3">{loading ? "Reviewing…" : "Get today’s guidance"}</button>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
    </div>
  );
}
