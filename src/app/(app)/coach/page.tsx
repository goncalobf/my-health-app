"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Brain, Send, Sparkles, Utensils, Trash2 } from "lucide-react";
import { api, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { CoachChatPayload, CoachMealPayload } from "@/lib/coach";
import CoachInsightCard, { CoachInsightRow } from "@/components/CoachInsightCard";
import PageHeader from "@/components/PageHeader";
import NutritionPhaseCard from "@/components/NutritionPhaseCard";

interface Message { id: number; role: "user" | "assistant"; content: string; createdAt: string; }

export default function CoachPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [insights, setInsights] = useState<CoachInsightRow[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [generating, setGenerating] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [mealLoading, setMealLoading] = useState(false);
  const [mealIdeas, setMealIdeas] = useState<CoachMealPayload | null>(null);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [coach, chat] = await Promise.all([
      apiGet<{ configured: boolean; insights: CoachInsightRow[] }>("/api/coach/insights"),
      apiGet<{ configured: boolean; messages: Message[] }>("/api/coach/chat"),
    ]);
    setConfigured(coach.configured); setInsights(coach.insights); setMessages(chat.messages);
  }
  useEffect(() => { load().catch(() => setConfigured(false)); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function generateWeekly() {
    setGenerating(true); setError("");
    try {
      const row = await apiPost<CoachInsightRow>("/api/coach/insights", { kind: "weekly", refresh: true });
      setInsights((rows) => [row, ...rows.filter((x) => x.id !== row.id)]);
    } catch (e) { setError(e instanceof Error ? e.message : "Coach unavailable"); }
    finally { setGenerating(false); }
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    const text = question.trim(); if (!text) return;
    setQuestion(""); setChatting(true); setError("");
    const optimistic: Message = { id: Date.now(), role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages((rows) => [...rows, optimistic]);
    try {
      const answer = await apiPost<CoachChatPayload>("/api/coach/chat", { message: text });
      setMessages((rows) => [...rows, { id: Date.now() + 1, role: "assistant", content: JSON.stringify(answer), createdAt: new Date().toISOString() }]);
    } catch (e) { setMessages((rows) => rows.filter((x) => x !== optimistic)); setError(e instanceof Error ? e.message : "Coach unavailable"); }
    finally { setChatting(false); }
  }

  if (configured === null) return <p className="text-sm text-muted">Loading Coach…</p>;
  if (!configured) return (
    <div><PageHeader title="Fitlog Coach" />
      <div className="card p-6 text-center border-accent/30">
        <Brain size={34} className="text-accent mx-auto" /><h2 className="text-xl font-bold mt-3">Ready to connect</h2>
        <p className="text-sm text-muted mt-2">Add <code className="text-text">OPENAI_API_KEY</code> to the Vercel project environment, then redeploy. The key stays on the server.</p>
        <div className="bg-surface-2 rounded-xl p-3 text-left text-xs text-muted mt-4">
          Fitlog sends aggregated workout, nutrition, weight and Garmin data. Progress photos and private measurement notes are excluded. Requests use <code className="text-text">store: false</code>; standard API abuse-monitoring retention may still apply for up to 30 days. AI never changes your plan automatically.
        </div>
      </div>
    </div>
  );

  const weekly = insights.filter((x) => x.kind === "weekly");
  return (
    <div>
      <PageHeader title="Fitlog Coach" />
      <div className="card p-4 mb-5 bg-gradient-to-br from-accent/15 to-transparent border-accent/30">
        <div className="flex items-center gap-3"><Brain size={24} className="shrink-0 text-accent" /><div className="min-w-0"><p className="font-semibold">Your private training partner</p><p className="text-xs text-muted">Evidence from your Fitlog data, reviewed by you.</p></div></div>
      </div>

      <div className="mb-5">
        <NutritionPhaseCard />
      </div>

      <section className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-2"><h2 className="min-w-0 text-sm font-semibold text-muted">Weekly review</h2><button onClick={generateWeekly} disabled={generating} className="flex shrink-0 items-center gap-1 text-sm text-accent"><Sparkles size={15} /> {generating ? "Reviewing…" : "Generate"}</button></div>
        {weekly[0] ? <CoachInsightCard row={weekly[0]} onDismiss={async (id) => { await apiPatch("/api/coach/insights", { id }); setInsights((rows) => rows.filter((x) => x.id !== id)); }} /> : <div className="card p-5 text-center"><p className="text-sm text-muted">Generate a review after you have logged several days of training, food, weight and Garmin totals.</p></div>}
      </section>

      <section className="mb-6">
        <div className="flex items-center justify-between gap-2 mb-2"><h2 className="min-w-0 text-sm font-semibold text-muted">Meal ideas for today</h2><Utensils size={17} className="shrink-0 text-muted" /></div>
        {mealIdeas ? <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">{mealIdeas.summary}</p>
          {mealIdeas.ideas.map((idea) => <div key={idea.name} className="card p-4"><p className="font-semibold">{idea.name}</p><p className="text-xs text-muted mt-1">{idea.portion}</p><p className="text-sm mt-2">{idea.why}</p><p className="text-xs text-muted mt-2">~{Math.round(idea.estimatedCalories)} kcal · {Math.round(idea.estimatedProteinG)}P {Math.round(idea.estimatedCarbsG)}C {Math.round(idea.estimatedFatG)}F</p><p className="text-xs text-muted mt-1">{idea.ingredients.join(" · ")}</p></div>)}
        </div> : <button onClick={async () => {
          setMealLoading(true); setError("");
          try { setMealIdeas(await apiPost<CoachMealPayload>("/api/coach/meals", { meal: "next meal" })); }
          catch (e) { setError(e instanceof Error ? e.message : "Coach unavailable"); }
          finally { setMealLoading(false); }
        }} disabled={mealLoading} className="btn-ghost w-full"><Utensils size={18} /> {mealLoading ? "Planning…" : "Suggest meals from remaining macros"}</button>}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2"><h2 className="text-sm font-semibold text-muted">Ask Fitlog</h2>{messages.length > 0 && <button onClick={async () => { await api("/api/coach/chat", { method: "DELETE" }); setMessages([]); }} className="text-muted p-1" aria-label="Clear chat"><Trash2 size={15} /></button>}</div>
        <div className="card p-3 min-h-48 max-h-[52vh] overflow-y-auto flex flex-col gap-3">
          {messages.length === 0 && <div className="text-center py-8"><Brain size={26} className="text-muted mx-auto" /><p className="text-sm text-muted mt-2">Ask about a plateau, recent training, nutrition consistency, or today’s macros.</p></div>}
          {messages.map((message) => <ChatBubble key={message.id} message={message} onFollowUp={setQuestion} />)}
          {chatting && <p className="text-xs text-muted">Coach is reviewing your data…</p>}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={ask} className="flex gap-2 mt-2"><input className="input min-w-0 flex-1" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about your progress…" maxLength={1200} /><button className="btn-primary shrink-0 px-3" disabled={chatting || !question.trim()} aria-label="Send"><Send size={18} /></button></form>
      </section>
      {error && <p className="text-sm text-danger mt-3">{error}</p>}
      <p className="text-[10px] text-muted text-center mt-5">AI-generated fitness guidance is not medical advice. Requests exclude photos and use store: false.</p>
    </div>
  );
}

function ChatBubble({ message, onFollowUp }: { message: Message; onFollowUp: (value: string) => void }) {
  if (message.role === "user") return <div className="max-w-[86%] self-end break-words rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm text-bg">{message.content}</div>;
  let payload: CoachChatPayload;
  try { payload = JSON.parse(message.content) as CoachChatPayload; }
  catch { payload = { answer: message.content, followUpQuestions: [], caution: null }; }
  return <div className="max-w-[92%] self-start break-words rounded-2xl rounded-bl-md bg-surface-2 px-3 py-3 text-sm">
    <p className="whitespace-pre-wrap break-words">{payload.answer}</p>
    {payload.caution && <p className="text-xs text-warn mt-2">{payload.caution}</p>}
    {payload.followUpQuestions.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{payload.followUpQuestions.map((q) => <button key={q} onClick={() => onFollowUp(q)} className="text-xs border border-border rounded-full px-2 py-1 text-muted">{q}</button>)}</div>}
  </div>;
}
