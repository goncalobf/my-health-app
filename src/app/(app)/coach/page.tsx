"use client";

import { useEffect, useState } from "react";
import { Sparkles, Utensils, Trash2, X, ChevronDown } from "lucide-react";
import { api, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { CoachMealPayload } from "@/lib/coach";
import CoachConversation from "@/components/CoachConversation";
import CoachInsightCard, { CoachInsightRow } from "@/components/CoachInsightCard";
import PageHeader from "@/components/PageHeader";
import NutritionPhaseCard from "@/components/NutritionPhaseCard";

export default function CoachPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [insights, setInsights] = useState<CoachInsightRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const [mealLoading, setMealLoading] = useState(false);
  const [mealIdeas, setMealIdeas] = useState<CoachMealPayload | null>(null);
  const [memoryNotes, setMemoryNotes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [memoryError, setMemoryError] = useState("");
  const [forgetting, setForgetting] = useState(false);

  useEffect(() => {
    apiGet<{ configured: boolean; insights: CoachInsightRow[] }>("/api/coach/insights")
      .then((data) => { setConfigured(data.configured); setInsights(data.insights); })
      .catch(() => setConfigured(false));
    apiGet<{ notes: string[] }>("/api/coach/memory")
      .then((data) => setMemoryNotes(data.notes))
      .catch(() => setMemoryError("Couldn’t load Coach memory."));
  }, []);

  async function forget(index?: number) {
    setMemoryError("");
    setForgetting(true);
    try {
      const query = index === undefined ? "" : `?index=${index}`;
      const result = await api<{ notes: string[] }>(`/api/coach/memory${query}`, {
        method: "DELETE",
        body: index === undefined ? undefined : JSON.stringify({ note: memoryNotes[index] }),
      });
      setMemoryNotes(result.notes);
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : "Couldn’t update Coach memory. Try again.");
      const latest = await apiGet<{ notes: string[] }>("/api/coach/memory").catch(() => null);
      if (latest) setMemoryNotes(latest.notes);
    } finally {
      setForgetting(false);
    }
  }

  async function generateWeekly() {
    setGenerating(true); setError("");
    try {
      const row = await apiPost<CoachInsightRow>("/api/coach/insights", { kind: "weekly", refresh: true });
      setInsights((rows) => [row, ...rows.filter((x) => x.id !== row.id)]);
    } catch (e) { setError(e instanceof Error ? e.message : "Coach unavailable"); }
    finally { setGenerating(false); }
  }

  const weekly = insights.find((insight) => insight.kind === "weekly");
  return (
    <div className="space-y-5">
      <PageHeader title="AI Coach" />
      <CoachConversation />

      <details className="card p-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-extrabold [&::-webkit-details-marker]:hidden">
          Reviews and ideas <ChevronDown size={17} className="shrink-0 text-muted" aria-hidden="true" />
        </summary>
        <div className="mt-3">
          {configured === false && <p className="mb-3 text-sm text-muted">Coach reviews and meal ideas are unavailable.</p>}
          {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
          <div className="grid items-start gap-3 min-[640px]:grid-cols-2">
            <div className="card space-y-3 p-4">
              <div className="flex items-center gap-2">
                <span className="icon-frame"><Sparkles size={17} aria-hidden="true" /></span>
                <h3 className="font-extrabold">Weekly review</h3>
              </div>
              <p className="text-xs text-muted">Review recent workouts, nutrition and recovery.</p>
              <button onClick={generateWeekly} disabled={!configured || generating} className="btn-ghost w-full">
                {generating ? "Reviewing…" : "Generate review"}
              </button>
            </div>
            <div className="card space-y-3 p-4">
              <div className="flex items-center gap-2">
                <span className="icon-frame"><Utensils size={17} aria-hidden="true" /></span>
                <h3 className="font-extrabold">Meal ideas</h3>
              </div>
              <p className="text-xs text-muted">Find meal ideas using your remaining macros.</p>
              <button onClick={async () => {
                setMealLoading(true); setError("");
                try { setMealIdeas(await apiPost<CoachMealPayload>("/api/coach/meals", { meal: "next meal" })); }
                catch (e) { setError(e instanceof Error ? e.message : "Coach unavailable"); }
                finally { setMealLoading(false); }
              }} disabled={!configured || mealLoading} className="btn-ghost w-full">{mealLoading ? "Planning…" : "Suggest meals"}</button>
            </div>
          </div>
          {weekly && (
            <div className="mt-3">
              <CoachInsightCard row={weekly} onDismiss={async (id) => {
                try {
                  await apiPatch("/api/coach/insights", { id });
                  setInsights((rows) => rows.filter((x) => x.id !== id));
                } catch {
                  setError("Couldn’t dismiss this review. Try again.");
                }
              }} />
            </div>
          )}
          {mealIdeas && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-muted">{mealIdeas.summary}</p>
              {mealIdeas.ideas.map((idea) => (
                <div key={idea.name} className="card p-4">
                  <p className="font-bold">{idea.name}</p>
                  <p className="mt-1 text-xs text-muted">{idea.portion}</p>
                  <p className="mt-2 text-sm">{idea.why}</p>
                  <p className="mt-2 text-xs text-muted">About {Math.round(idea.estimatedCalories)} kcal · {Math.round(idea.estimatedProteinG)} g protein · {Math.round(idea.estimatedCarbsG)} g carbs · {Math.round(idea.estimatedFatG)} g fat</p>
                  <p className="mt-1 text-xs text-muted">{idea.ingredients.join(" · ")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      <NutritionPhaseCard />

      <details className="card p-4">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 font-extrabold [&::-webkit-details-marker]:hidden">
          What Coach remembers <ChevronDown size={17} className="shrink-0 text-muted" aria-hidden="true" />
        </summary>
        {memoryError && <p role="alert" className="mt-2 text-sm text-danger">{memoryError}</p>}
        {memoryNotes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Coach can save useful patterns from your conversations. You can review and remove them here.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {memoryNotes.map((note, index) => (
              <div key={`${index}-${note.slice(0, 24)}`} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2.5">
                <p className="min-w-0 flex-1 break-words text-sm">{note}</p>
                <button onClick={() => forget(index)} disabled={forgetting} className="icon-button" aria-label="Forget this"><X size={16} /></button>
              </div>
            ))}
            <button onClick={() => forget()} disabled={forgetting} className="btn-danger"><Trash2 size={16} /> Forget everything</button>
          </div>
        )}
      </details>
      <details className="px-1 text-sm text-muted">
        <summary className="cursor-pointer font-semibold text-accent">About Coach and your data</summary>
        <p className="mt-2 text-xs leading-relaxed">Coach sends relevant workout, food, weight and Garmin data to generate guidance. It excludes photos and private measurement notes. Requests use storage disabled. Provider abuse-monitoring retention may still apply. Coach offers fitness guidance and leaves changes to your plan up to you.</p>
      </details>
    </div>
  );
}
