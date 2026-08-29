import { round } from "@/lib/utils";

interface Totals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
interface Targets {
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
}

function Bar({
  label,
  value,
  target,
  color,
  unit = "g",
}: {
  label: string;
  value: number;
  target: number;
  color: string;
  unit?: string;
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="min-w-0 border-l border-border pl-3 first:border-l-0 first:pl-0">
      <div className="mb-2 flex items-baseline justify-between gap-1">
        <span className="font-display text-base uppercase tracking-[0.08em] text-muted">{label}</span>
        <span className="text-[10px] tabular-nums text-muted">/{round(target, 0)}{unit}</span>
      </div>
      <p className="data-number text-2xl leading-none">{round(value, 0)}<span className="ml-0.5 text-xs text-muted">{unit}</span></p>
      <div className="mt-2 h-1 overflow-hidden bg-surface-2">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function MacroSummary({
  totals,
  targets,
}: {
  totals: Totals;
  targets: Targets;
}) {
  const kcalPct =
    targets.targetCalories > 0
      ? Math.min(100, (totals.calories / targets.targetCalories) * 100)
      : 0;
  return (
    <div className="card flex min-w-0 flex-col overflow-hidden p-4 min-[360px]:p-5">
      <div className="flex min-w-0 items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="label">Daily fuel</p>
          <p className="data-number mt-1 text-5xl leading-none min-[360px]:text-6xl">{round(totals.calories, 0)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted">Kcal consumed</p>
        </div>
        <div className="shrink-0 pb-1 text-right">
          <p className="data-number text-3xl leading-none text-accent">{round(targets.targetCalories - totals.calories, 0)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted">Remaining</p>
        </div>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden bg-surface-2"><div className="h-full bg-accent transition-all" style={{ width: `${kcalPct}%` }} /></div>
      <div className="mt-2 flex justify-between text-[9px] uppercase tracking-[0.12em] text-muted"><span>0</span><span>Target {round(targets.targetCalories, 0)}</span></div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
        <Bar
          label="Protein"
          value={totals.proteinG}
          target={targets.targetProteinG}
          color="#d6ff45"
        />
        <Bar
          label="Carbs"
          value={totals.carbsG}
          target={targets.targetCarbsG}
          color="#ffc857"
        />
        <Bar
          label="Fat"
          value={totals.fatG}
          target={targets.targetFatG}
          color="#ff5a4f"
        />
      </div>
    </div>
  );
}
