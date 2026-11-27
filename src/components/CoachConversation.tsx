"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Sparkles, Trash2 } from "lucide-react";
import { api, apiDelete, apiPost } from "@/lib/api";
import { COACH_QUESTION_LIMIT, readCoachReply, type CoachMessage } from "@/lib/coach-chat";

type Conversation = { configured: boolean; messages: CoachMessage[] };

export default function CoachConversation() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await api<Conversation>("/api/coach/chat", { signal });
      if (!signal?.aborted) setConversation(result);
    } catch {
      if (!signal?.aborted) setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const messages = conversation?.messages;
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, pending]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!conversation?.configured || inFlight.current || !question) return;
    inFlight.current = true;
    setPending(question);
    setError("");
    try {
      const reply = await apiPost<{ messages: CoachMessage[] }>("/api/coach/chat", { message: question });
      setConversation((current) => current && {
        ...current, messages: [...current.messages, ...reply.messages].slice(-30),
      });
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t send your question. Try again.");
      await load();
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function clearConversation() {
    if (inFlight.current || !window.confirm("Clear your chat history?")) return;
    inFlight.current = true;
    setClearing(true);
    setError("");
    try {
      await apiDelete("/api/coach/chat");
      setConversation((current) => current && { ...current, messages: [] });
    } catch {
      setError("Couldn’t clear the conversation. Try again.");
    } finally {
      inFlight.current = false;
      setClearing(false);
    }
  }

  function suggestQuestion(question: string) {
    setDraft((current) => current.trim()
      ? `${current.trimEnd()}\n${question}`.slice(0, COACH_QUESTION_LIMIT)
      : question.slice(0, COACH_QUESTION_LIMIT));
    composer.current?.focus();
  }

  const busy = pending !== null || clearing;
  return (
    <section className="card overflow-hidden" aria-labelledby="coach-chat-heading">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="icon-frame"><Sparkles size={19} aria-hidden="true" /></span>
        <h2 id="coach-chat-heading" className="min-w-0 flex-1 text-lg font-extrabold">Conversation</h2>
        {!!messages?.length && (
          <button type="button" onClick={clearConversation} disabled={busy} className="icon-button disabled:opacity-50" aria-label="Clear chat">
            <Trash2 size={16} aria-hidden="true" />
          </button>
        )}
      </header>
      {!conversation ? (
        <div className="p-5">
          {loadFailed ? (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert" className="text-sm text-danger">Couldn’t load your conversation.</p>
              <button type="button" className="btn-ghost" onClick={() => { setLoadFailed(false); void load(); }}>Retry</button>
            </div>
          ) : <p className="text-sm text-muted" role="status">Loading conversation…</p>}
        </div>
      ) : (
        <>
          {messages?.length || pending ? (
            <div ref={log} className="max-h-[52dvh] min-h-36 overflow-y-auto p-4 min-[375px]:p-5" aria-label="Conversation history" role="log" tabIndex={0}>
              <div className="flex flex-col gap-4">
                {messages?.map((message, index) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    onFollowUp={conversation.configured && !busy && index === messages.length - 1 ? suggestQuestion : undefined}
                  />
                ))}
                {pending && <UserBubble text={pending} />}
                {pending && <p role="status" className="self-start rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">Coach is thinking…</p>}
              </div>
            </div>
          ) : (
            <div className="flex min-h-40 flex-col justify-center gap-2 p-5">
              <p className="text-lg font-extrabold text-text">What’s on your mind?</p>
              <p className="max-w-sm text-sm text-muted">Ask about your training, recovery, or nutrition in your own words.</p>
            </div>
          )}
          {error && <p role="alert" className="mx-3 mb-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          {conversation.configured ? (
            <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3 min-[375px]:p-4">
              <textarea
                ref={composer}
                aria-label="Ask Coach"
                className="input min-w-0 flex-1 resize-y"
                rows={2}
                value={pending ? "" : draft}
                readOnly={busy}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Write a question…"
                maxLength={COACH_QUESTION_LIMIT}
              />
              <button type="submit" className="btn-primary shrink-0 px-3" disabled={busy || !draft.trim()} aria-label="Send">
                <Send size={18} aria-hidden="true" />
              </button>
            </form>
          ) : <p className="border-t border-border p-4 text-sm text-muted" role="status">Coach is currently unavailable.</p>}
        </>
      )}
    </section>
  );
}

function UserBubble({ text }: { text: string }) {
  return <p className="max-w-[86%] self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent px-3 py-2 text-sm text-on-accent">{text}</p>;
}

function ChatBubble({ message, onFollowUp }: { message: CoachMessage; onFollowUp?: (value: string) => void }) {
  if (message.role === "user") return <UserBubble text={message.content} />;
  const { answer, caution, followUpQuestions } = readCoachReply(message.content);
  return (
    <div className="max-w-[96%] self-start break-words rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3 text-sm leading-relaxed">
      <p className="whitespace-pre-wrap break-words">{answer}</p>
      {caution && <p className="mt-2 text-xs text-warn">{caution}</p>}
      {onFollowUp && followUpQuestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          {followUpQuestions.map((question, index) => (
            <button key={index} type="button" onClick={() => onFollowUp(question)} className="btn-ghost max-w-full px-3 text-left text-xs">{question}</button>
          ))}
        </div>
      )}
    </div>
  );
}
