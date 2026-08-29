"use client";

import { useEffect, useRef, useState } from "react";
import { X, Timer } from "lucide-react";
import { formatDuration } from "@/lib/utils";

export default function RestTimer({
  targetSeconds,
  label,
  note,
  onEnd,
}: {
  targetSeconds: number;
  label: string;
  note?: string | null;
  onEnd: () => void;
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 safe-bottom">
      <div className="mx-auto max-w-lg px-4">
        <div className="card pointer-events-auto mb-3 border-accent/40 bg-surface/95 p-3 shadow-xl backdrop-blur">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <Timer
              size={22}
              className={reached ? "text-accent" : "text-muted"}
            />
            <div className="min-w-0">
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-xs text-muted">
                  Resting · {label}
                </span>
                <span
                  className={`shrink-0 text-lg font-bold tabular-nums ${
                    reached ? "text-accent" : ""
                  }`}
                >
                  {formatDuration(elapsed)}
                  {targetSeconds > 0 && (
                    <span className="text-xs text-muted font-normal">
                      {" "}
                      / {formatDuration(targetSeconds)}
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: reached ? "#22d3a6" : "#178b6d",
                  }}
                />
              </div>
            </div>
            <button
              onClick={onEnd}
              className="btn-primary h-10 shrink-0 px-3 py-0 text-sm"
              aria-label="End rest timer"
            >
              <X size={16} /> End
            </button>
          </div>
          {note && (
            <p className="mt-2.5 border-t border-border pt-2 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
