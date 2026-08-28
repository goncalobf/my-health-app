"use client";

import { Brain, Dumbbell, Apple, HeartPulse, TrendingUp, X } from "lucide-react";
import type { CoachInsightPayload } from "@/lib/coach";

export interface CoachInsightRow {
  id: number;
  kind: string;
  sourceKey: string | null;
  createdAt: string;
  payload: CoachInsightPayload;
}

const categoryIcon = {
  training: Dumbbell,
  nutrition: Apple,
  recovery: HeartPulse,
  progress: TrendingUp,
};

export default function CoachInsightCard({ row, onDismiss, compact = false }: {
  row: CoachInsightRow;
  onDismiss?: (id: number) => void;
  compact?: boolean;
}) {
  const insights = compact ? row.payload.insights.slice(0, 2) : row.payload.insights;
  return (
    <article className="card p-4 border-accent/30">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0"><Brain size={19} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-accent uppercase tracking-wide font-semibold">Fitlog Coach · {row.kind.replace("_", " ")}</p>
          <h3 className="font-semibold mt-0.5">{row.payload.headline}</h3>
        </div>
        {onDismiss && <button onClick={() => onDismiss(row.id)} className="text-muted p-1" aria-label="Dismiss insight"><X size={17} /></button>}
      </div>
      <div className="flex flex-col gap-3 mt-4">
        {insights.map((insight, index) => {
          const Icon = categoryIcon[insight.category];
          return <div key={`${insight.title}-${index}`} className="bg-surface-2 rounded-xl p-3">
            <div className="flex items-center gap-2"><Icon size={15} className="text-muted" /><p className="font-medium text-sm">{insight.title}</p><span className="ml-auto text-[10px] text-muted capitalize">{insight.confidence}</span></div>
            <p className="text-sm text-muted mt-1.5">{insight.observation}</p>
            {insight.evidence.length > 0 && <ul className="mt-2 text-xs text-muted list-disc pl-4 space-y-1">{insight.evidence.map((item) => <li key={item}>{item}</li>)}</ul>}
            <p className="text-sm mt-2"><span className="text-accent font-medium">Try:</span> {insight.suggestion}</p>
          </div>;
        })}
      </div>
      {row.payload.caution && <p className="text-xs text-warn mt-3">{row.payload.caution}</p>}
      <p className="text-[10px] text-muted mt-3">AI-generated guidance · review before acting</p>
    </article>
  );
}
