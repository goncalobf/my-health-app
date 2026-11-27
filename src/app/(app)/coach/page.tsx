"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, Sparkles, Utensils, Trash2, X, ChevronDown } from "lucide-react";
import { api, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
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
  const [memoryNotes, setMemoryNotes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [coach, chat, memory] = await Promise.all([
      apiGet<{ configured: boolean; insights: CoachInsightRow[] }>("/api/coach/insights"),
      apiGet<{ configured: boolean; messages: Message[] }>("/api/coach/chat"),
      apiGet<{ notes: string[] }>("/api/coach/memory").catch(() => ({ notes: [] })),
    ]);
    setConfigured(coach.configured); setInsights(coach.insights); setMessages(chat.messages);
    setMemoryNotes(memory.notes);
  }
  useEffect(() => { load().catch(() => setConfigured(false)); }, []);

  async function forgetNote(index: number) {
    const result = await apiDelete<{ notes: string[] }>(`/api/coach/memory?index=${index}`);
    setMemoryNotes(result.notes);
  }
  async function forgetEverything() {
    const result = await apiDelete<{ notes: string[] }>("/api/coach/memory");
    setMemoryNotes(result.notes);
  }
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, chatting]);

  function fillQuestion(value: string) {
    setQuestion(value);
    questionRef.current?.focus();
  }

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
    } catch (e) { setMessages((rows) => rows.filter((x) => x !== optimistic)); setQuestion(text); setError(e instanceof Error ? e.message : "Coach unavailable"); }
    finally { setChatting(false); }
  }

  if (configured === null) {
    return <><PageHeader title="Coach" /><p role="status" className="card p-4 text-sm text-muted">Loading Coach…</p></>;
  }
  if (!configured) return (
    <>
      <PageHeader title="Coach" />
      <div className="card space-y-3 p-5">
        <span className="icon-frame"><Sparkles size={21} aria-hidden="true" /></span>
        <h2 className="text-xl">Coach is unavailable</h2>
        <p className="text-sm text-muted">Your training and nutrition logs are still available.</p>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-semibold text-accent">Setup details</summary>
          <p className="mt-2 break-words">For a self-hosted instance, configure <code>OPENAI_API_KEY</code> on the server.</p>
        </details>
      </div>
    </>
  );

  const weekly = insights.filter((x) => x.kind === "weekly");
  const prompts = [
    "Based on my sleep, should I train or rest today?",
    "How should I balance lifting and jiu-jitsu?",
    "What stands out in my recent training?",
    "Help me pick a mobility routine.",
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="Coach" description="Ask a question or review patterns in your Fitlog activity." />

      <section className="card overflow-hidden" aria-labelledby="coach-chat-heading">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 min-[375px]:px-5">
          <span className="icon-frame"><Sparkles size={20} aria-hidden="true" /></span>
          <h2 id="coach-chat-heading" className="min-w-0 flex-1 text-lg">Ask Coach</h2>
          {messages.length > 0 && (
            <button onClick={async () => {
              if (!window.confirm("Clear your chat history?")) return;
              await api("/api/coach/chat", { method: "DELETE" });
              setMessages([]);
            }} className="icon-button" aria-label="Clear chat"><Trash2 size={16} /></button>
          )}
        </div>

        {messages.length ? (
          <div ref={chatRef} className="max-h-[50dvh] min-h-40 space-y-3 overflow-y-auto p-4 min-[375px]:p-5" aria-label="Conversation" role="log">
            <div className="flex flex-col gap-3">
              {messages.map((message) => <ChatBubble key={message.id} message={message} onFollowUp={fillQuestion} />)}
              {chatting && <p role="status" className="text-xs text-muted">Coach is reviewing your data…</p>}
            </div>
          </div>
        ) : (
          <div className="space-y-2 bg-accent-soft/45 p-4 min-[375px]:p-5">
            <p className="label">Try a question</p>
            <div className="flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => fillQuestion(prompt)} className="btn-ghost px-3 text-left text-xs">{prompt}</button>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={ask} className="flex gap-2 border-t border-border p-3 min-[375px]:p-4">
          <input
            ref={questionRef}
            aria-label="Ask Coach"
            className="input min-w-0 flex-1"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Write a question…"
            maxLength={1200}
          />
          <button className="btn-primary shrink-0 px-3" disabled={chatting || !question.trim()} aria-label="Send"><Send size={18} /></button>
        </form>
      </section>

      {error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <section aria-labelledby="coach-tools-heading">
        <h2 id="coach-tools-heading" className="section-title">Reviews and ideas</h2>
        <div className="grid items-start gap-3 min-[640px]:grid-cols-2">
          <div className="card space-y-3 p-4">
            <div className="flex items-center gap-2">
              <span className="icon-frame"><Sparkles size={17} aria-hidden="true" /></span>
              <h3 className="font-extrabold">Weekly review</h3>
            </div>
            <p className="text-xs text-muted">Review recent workouts, nutrition and recovery.</p>
            <button onClick={generateWeekly} disabled={generating} className="btn-ghost w-full">
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
            }} disabled={mealLoading} className="btn-ghost w-full">{mealLoading ? "Planning…" : "Suggest meals"}</button>
          </div>
        </div>
        {weekly[0] && (
          <div className="mt-3">
            <CoachInsightCard row={weekly[0]} onDismiss={async (id) => {
              await apiPatch("/api/coach/insights", { id });
              setInsights((rows) => rows.filter((x) => x.id !== id));
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
      </section>

      <NutritionPhaseCard />

      <details className="card p-4">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 font-extrabold [&::-webkit-details-marker]:hidden">
          What Coach remembers <ChevronDown size={17} className="shrink-0 text-muted" aria-hidden="true" />
        </summary>
        {memoryNotes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Coach can save useful patterns from your conversations. You can review and remove them here.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {memoryNotes.map((note, index) => (
              <div key={`${index}-${note.slice(0, 24)}`} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2.5">
                <p className="min-w-0 flex-1 break-words text-sm">{note}</p>
                <button onClick={() => forgetNote(index)} className="icon-button" aria-label="Forget this"><X size={16} /></button>
              </div>
            ))}
            <button onClick={forgetEverything} className="btn-danger"><Trash2 size={16} /> Forget everything</button>
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

function ChatBubble({ message, onFollowUp }: { message: Message; onFollowUp: (value: string) => void }) {
  if (message.role === "user") return <div className="max-w-[86%] self-end break-words rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm text-on-accent">{message.content}</div>;
  let payload: CoachChatPayload;
  try { payload = JSON.parse(message.content) as CoachChatPayload; }
  catch { payload = { answer: message.content, followUpQuestions: [], caution: null, memoryNote: null }; }
  return <div className="max-w-[92%] self-start break-words rounded-2xl rounded-bl-md bg-surface-2 px-3 py-3 text-sm">
    <p className="whitespace-pre-wrap break-words">{payload.answer}</p>
    {payload.caution && <p className="text-xs text-warn mt-2">{payload.caution}</p>}
    {payload.followUpQuestions.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{payload.followUpQuestions.map((q) => <button key={q} onClick={() => onFollowUp(q)} className="text-xs border border-border rounded-full px-2 py-1 text-muted">{q}</button>)}</div>}
  </div>;
}
