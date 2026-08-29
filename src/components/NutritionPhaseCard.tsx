"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import type { NutritionPhase } from "@/lib/nutrition-phase";

export default function NutritionPhaseCard() {
  const [phase, setPhase] = useState<NutritionPhase | null>(null);

  useEffect(() => {
    apiGet<NutritionPhase>("/api/coach/phase").then(setPhase).catch(() => {});
  }, []);

  if (!phase || phase.status === "inactive") return null;
  if (phase.status === "setup_required") {
    return (
      <Link
        href="/settings"
        className="card p-4 flex items-center gap-3 border-warn/30"
      >
        <div className="icon-frame border-warn/30 text-warn">
          <CalendarDays size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{phase.title}</p>
          <p className="text-xs text-muted mt-0.5">{phase.guidance}</p>
        </div>
        <ChevronRight size={18} className="text-muted" />
      </Link>
    );
  }

  return (
    <div className="card p-4 border-accent/30">
      <div className="flex items-center gap-3">
        <div className="icon-frame">
          <CalendarDays size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="label">Nutrition phase</p>
          <p className="font-semibold">{phase.title}</p>
        </div>
        <span className="shrink-0 text-xs text-muted tabular-nums">
          Day {phase.daysElapsed}
        </span>
      </div>
      <p className="text-sm mt-3">{phase.guidance}</p>
      <p className="text-xs text-muted mt-2">{phase.rateMessage}</p>
      <Link href="/settings" className="text-xs text-accent inline-block mt-3">
        Edit phase date
      </Link>
    </div>
  );
}
