"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import CoachInsightCard, { CoachInsightRow } from "@/components/CoachInsightCard";

export default function WorkoutCoach({ sessionId }: { sessionId: number }) {
  const [configured, setConfigured] = useState(false);
  const [row, setRow] = useState<CoachInsightRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    apiGet<{ configured: boolean; insights: CoachInsightRow[] }>("/api/coach/insights?kind=post_workout")
      .then((data) => {
        setConfigured(data.configured);
        setRow(data.insights.find((x) => x.sourceKey === `session:${sessionId}`) ?? null);
      }).catch(() => setConfigured(false));
  }, [sessionId]);
  if (!configured) return null;
  if (row) return <div className="mt-5"><CoachInsightCard row={row} /></div>;
  return <div className="card p-4 mt-5 text-center border-accent/30">
    <Sparkles size={22} className="text-accent mx-auto" /><p className="font-semibold mt-2">AI workout review</p><p className="text-xs text-muted mt-1">Connect today’s performance with your recent training trend.</p>
    <button className="btn-primary w-full mt-3" disabled={loading} onClick={async () => {
      setLoading(true); setError("");
      try { setRow(await apiPost<CoachInsightRow>("/api/coach/insights", { kind: "post_workout", sessionId })); }
      catch (e) { setError(e instanceof Error ? e.message : "Coach unavailable"); }
      finally { setLoading(false); }
    }}>{loading ? "Analyzing…" : "Analyze this workout"}</button>
    {error && <p className="text-xs text-danger mt-2">{error}</p>}
  </div>;
}
