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
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          {round(value, 0)}
          <span className="text-muted">
            {" "}
            / {round(target, 0)}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
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
    <div className="card p-4 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <div
          className="relative w-20 h-20 rounded-full shrink-0"
          style={{
            background: `conic-gradient(#22d3a6 ${kcalPct * 3.6}deg, #1b242e 0deg)`,
          }}
        >
          <div className="absolute inset-1.5 rounded-full bg-surface flex flex-col items-center justify-center">
            <span className="text-lg font-bold tabular-nums leading-none">
              {round(totals.calories, 0)}
            </span>
            <span className="text-[10px] text-muted">kcal</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted">Calories</p>
          <p className="text-2xl font-bold tabular-nums">
            {round(targets.targetCalories - totals.calories, 0)}
            <span className="text-sm font-normal text-muted"> left</span>
          </p>
          <p className="text-xs text-muted">
            of {round(targets.targetCalories, 0)} kcal target
          </p>
        </div>
      </div>
      <div className="grid gap-3">
        <Bar
          label="Protein"
          value={totals.proteinG}
          target={targets.targetProteinG}
          color="#22d3a6"
        />
        <Bar
          label="Carbs"
          value={totals.carbsG}
          target={targets.targetCarbsG}
          color="#f5a623"
        />
        <Bar
          label="Fat"
          value={totals.fatG}
          target={targets.targetFatG}
          color="#f2555a"
        />
      </div>
    </div>
  );
}
