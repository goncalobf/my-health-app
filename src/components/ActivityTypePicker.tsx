"use client";

import { useState } from "react";
import { X, Footprints, Repeat, Bike, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

const TYPES = [
  {
    type: "run_easy",
    label: "Easy run",
    sub: "Distance · pace · elevation · HR",
    Icon: Footprints,
  },
  {
    type: "run_interval",
    label: "Interval run",
    sub: "Per-interval splits · pace · HR",
    Icon: Repeat,
  },
  {
    type: "indoor_cycling",
    label: "Indoor cycling",
    sub: "Duration · heart rate",
    Icon: Bike,
  },
  {
    type: "outdoor_cycling",
    label: "Outdoor cycling",
    sub: "Distance · speed · elevation · HR",
    Icon: Bike,
  },
  {
    type: "hyrox",
    label: "Hyrox",
    sub: "8 runs · 8 stations · splits",
    Icon: Zap,
  },
] as const;

export default function ActivityTypePicker({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  async function start(type: string) {
    setStarting(true);
    try {
      const session = await apiPost<{ id: number }>("/api/cardio-sessions", { type });
      router.push(`/workouts/cardio/${session.id}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="card mx-auto w-full max-w-xl rounded-b-none pb-safe">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="font-display text-lg tracking-[0.08em] uppercase">
            Choose activity
          </span>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center text-muted"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-col gap-2 p-4">
          {TYPES.map(({ type, label, sub, Icon }) => (
            <button
              key={type}
              disabled={starting}
              onClick={() => start(type)}
              className="card flex items-center gap-4 p-4 text-left active:scale-[0.98] transition disabled:opacity-50"
            >
              <div className="icon-frame shrink-0">
                <Icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl tracking-[0.04em]">{label}</p>
                <p className="text-xs text-muted">{sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
