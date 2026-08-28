"use client";

import { useEffect, useRef, useState } from "react";
import { X, Timer } from "lucide-react";
import { formatDuration } from "@/lib/utils";

export default function RestTimer({
  startedAt,
  targetSeconds,
  label,
  onEnd,
}: {
  startedAt: number;
  targetSeconds: number;
  label: string;
  onEnd: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const buzzed = useRef(false);

  useEffect(() => {
    buzzed.current = false;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [startedAt]);

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
    <div className="fixed inset-x-0 bottom-[64px] z-40 safe-bottom pointer-events-none">
      <div className="max-w-lg mx-auto px-4">
        <div className="card p-3 pointer-events-auto border-accent/40 bg-surface/95 backdrop-blur shadow-lg">
          <div className="flex items-center gap-3">
            <Timer
              size={22}
              className={reached ? "text-accent" : "text-muted"}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted truncate">
                  Resting · {label}
                </span>
                <span
                  className={`text-lg font-bold tabular-nums ${
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
              <div className="h-1.5 rounded-full bg-surface-2 mt-1.5 overflow-hidden">
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
              className="shrink-0 btn-primary py-2 px-3 text-sm"
            >
              End rest
            </button>
            <button
              onClick={onEnd}
              className="shrink-0 text-muted p-1"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
