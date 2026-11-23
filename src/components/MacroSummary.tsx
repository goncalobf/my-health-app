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

function Meter({ value, target, color }: { value: number; target: number; color: string }) {
  const width = target > 0 ? Math.max(0, Math.min(100, (value / target) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
      <div className={`h-full rounded-full transition-[width] ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export default function MacroSummary({ totals, targets }: { totals: Totals; targets: Targets }) {
  const balance = round(targets.targetCalories - totals.calories, 0);
  const macros = [
    { name: "Protein", value: totals.proteinG, target: targets.targetProteinG, color: "bg-accent" },
    { name: "Carbs", value: totals.carbsG, target: targets.targetCarbsG, color: "bg-success" },
    { name: "Fat", value: totals.fatG, target: targets.targetFatG, color: "bg-warn" },
  ];
  return (
    <div className="card min-w-0 space-y-4 p-4 min-[375px]:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="label">Calories logged</p>
          <p className="data-number mt-0.5 text-4xl leading-none">
            {round(totals.calories, 0)}<span className="ml-1.5 text-sm font-semibold text-muted">kcal</span>
          </p>
        </div>
        <p className="text-xs font-bold text-accent">
          {balance >= 0 ? `${balance} kcal remaining` : `${Math.abs(balance)} kcal above target`}
        </p>
      </div>
      <div>
        <Meter value={totals.calories} target={targets.targetCalories} color="bg-accent" />
        <p className="mt-1.5 text-xs text-muted">Daily target {round(targets.targetCalories, 0)} kcal</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        {macros.map((macro) => (
          <div key={macro.name} className="min-w-0 space-y-1.5">
            <dt className="label">{macro.name}</dt>
            <dd className="text-sm font-extrabold tabular-nums">
              {round(macro.value, 0)}<span className="text-xs font-medium text-muted"> / {round(macro.target, 0)} g</span>
            </dd>
            <Meter value={macro.value} target={macro.target} color={macro.color} />
          </div>
        ))}
      </dl>
    </div>
  );
}
