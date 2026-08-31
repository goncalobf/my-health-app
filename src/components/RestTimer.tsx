"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Timer } from "lucide-react";
import { formatDuration } from "@/lib/utils";

export default function RestTimer({
  targetSeconds,
  label,
  note,
  hasNext,
  onNext,
}: {
  targetSeconds: number;
  label: string;
  note?: string | null;
  hasNext: boolean;
  onNext: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const buzzed = useRef(false);

  // The timer owns its own clock: mount one per rest period via a changing key.
  useEffect(() => {
    const startedAt = Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, []);

  const reached = targetSeconds > 0 && elapsed >= targetSeconds;
  useEffect(() => {
    if (reached && !buzzed.current) {
      buzzed.current = true;
      navigator.vibrate?.(200);
    }
  }, [reached]);

  const pct =
    targetSeconds > 0 ? Math.min(100, (elapsed / targetSeconds) * 100) : 0;

  return (
    <div className="card min-w-0 overflow-hidden p-4 min-[360px]:p-5">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent">
          Resting
        </p>
        <Timer size={18} className={reached ? "text-accent" : "text-muted"} />
      </div>

      <p className="min-w-0 truncate text-sm text-muted">
        {hasNext ? `Up next · ${label}` : "That's the last set — nice work"}
      </p>

      <div className="mt-3 flex items-baseline justify-center gap-2">
        <span
          className={`font-display text-6xl tabular-nums ${reached ? "text-accent" : ""}`}
        >
          {formatDuration(elapsed)}
        </span>
        {targetSeconds > 0 && (
          <span className="text-sm text-muted">
            / {formatDuration(targetSeconds)}
          </span>
        )}
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: reached ? "#d6ff45" : "#93ae39",
          }}
        />
      </div>

      {note && (
        <p className="mt-4 border-t border-border pt-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          {note}
        </p>
      )}

      <button
        onClick={onNext}
        className="btn-primary mt-4 w-full py-3.5 text-base"
      >
        {hasNext ? "Next set" : "Continue"} <ChevronRight size={19} strokeWidth={3} />
      </button>
    </div>
  );
}
