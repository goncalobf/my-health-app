"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, BookmarkPlus } from "lucide-react";
import { apiGet, apiDelete, apiPatch, apiPost } from "@/lib/api";
import { todayISO, formatDate, round, shiftISODate } from "@/lib/utils";
import { parseDecimalInput } from "@/lib/decimal-input";
import MacroSummary from "@/components/MacroSummary";
import FoodLogger from "@/components/FoodLogger";
import PageHeader from "@/components/PageHeader";
import { preloadBarcodeReader } from "@/lib/barcode-scanner-loader";

interface Log {
  id: number;
  meal: string;
  name: string;
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
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

const MEALS = ["breakfast", "lunch", "dinner", "snack"];

export default function NutritionPage() {
  const [day, setDay] = useState(todayISO());
  const [logs, setLogs] = useState<Log[]>([]);
  const [totals, setTotals] = useState<Totals>({
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  });
  const [targets, setTargets] = useState<Targets>({
    targetCalories: 2200,
    targetProteinG: 160,
    targetCarbsG: 220,
    targetFatG: 70,
  });
  const [logging, setLogging] = useState<string | null>(null);

  const loadDay = useCallback(async () => {
    const data = await apiGet<{ logs: Log[]; totals: Totals }>(
      `/api/nutrition?day=${day}`
    );
    setLogs(data.logs);
    setTotals(data.totals);
  }, [day]);

  useEffect(() => {
    preloadBarcodeReader();
    apiGet<Targets>("/api/settings").then(setTargets);
  }, []);
  useEffect(() => {
    loadDay();
  }, [loadDay]);

  async function remove(logId: number) {
    await apiDelete(`/api/nutrition/${logId}`);
    loadDay();
  }

  async function editQuantity(log: Log) {
    const next = window.prompt(`Quantity for ${log.name} (grams)`, String(log.quantityG));
    const quantityG = next == null ? 0 : parseDecimalInput(next);
    if (quantityG <= 0) return;
    await apiPatch(`/api/nutrition/${log.id}`, { quantityG });
    loadDay();
  }

  async function saveMeal(meal: string, items: Log[]) {
    const name = window.prompt("Save this meal as", `${meal[0].toUpperCase()}${meal.slice(1)} favourite`);
    if (!name?.trim()) return;
    await apiPost("/api/meals", { name: name.trim(), items });
  }

  const isToday = day === todayISO();

  return (
    <div>
      <PageHeader title="Nutrition" />
      <div className="mb-5 flex items-center justify-between border-b border-border pb-4">
        <button
          onClick={() => setDay((d) => shiftISODate(d, -1))}
          className="flex h-10 w-10 items-center justify-center border border-border bg-surface-2 text-muted [border-radius:2px_10px_2px_2px]"
          aria-label="Previous day"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1 px-2 text-center">
          <p className="label mb-1">Food log / date</p>
          <h2 className="truncate font-display text-2xl leading-none tracking-[0.04em]">
            {isToday ? "Today" : formatDate(day)}
          </h2>
          {!isToday && (
            <button
              onClick={() => setDay(todayISO())}
              className="text-xs text-accent"
            >
              Back to today
            </button>
          )}
        </div>
        <button
          onClick={() => setDay((d) => shiftISODate(d, 1))}
          disabled={isToday}
          className="flex h-10 w-10 items-center justify-center border border-border bg-surface-2 text-muted disabled:opacity-30 [border-radius:2px_10px_2px_2px]"
          aria-label="Next day"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <MacroSummary totals={totals} targets={targets} />

      <div className="flex flex-col gap-4 mt-5">
        {MEALS.map((meal, mealIndex) => {
          const items = logs.filter((l) => l.meal === meal);
          const kcal = items.reduce((a, l) => a + l.calories, 0);
          return (
            <div key={meal}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="min-w-0 flex-1 font-display text-2xl tracking-[0.05em]"><span className="mr-2 text-base text-muted/40">{String(mealIndex + 1).padStart(2, "0")}</span>{meal}</h2>
                <div className="flex shrink-0 items-center gap-2 min-[360px]:gap-3">
                  {kcal > 0 && (
                    <span className="text-sm text-muted tabular-nums">
                      {round(kcal, 0)} kcal
                    </span>
                  )}
                  {items.length > 0 && (
                    <button onClick={() => saveMeal(meal, items)} className="text-muted" aria-label={`Save ${meal} as meal`}><BookmarkPlus size={17} /></button>
                  )}
                  <button
                    onClick={() => setLogging(meal)}
                    className="flex h-8 w-8 items-center justify-center border border-accent/40 bg-accent/10 text-accent [border-radius:2px_8px_2px_2px]"
                    aria-label={`Add to ${meal}`}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              {items.length === 0 ? (
                <p className="border-l border-border py-2 pl-3 text-[10px] uppercase tracking-[0.12em] text-muted">Nothing logged</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((l) => (
                    <div
                      key={l.id}
                      className="card px-3 py-2.5 flex items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{l.name}</p>
                        <p className="text-xs text-muted">
                          {round(l.quantityG, 0)}g · {round(l.calories, 0)} kcal
                          · {round(l.proteinG, 0)}P {round(l.carbsG, 0)}C{" "}
                          {round(l.fatG, 0)}F
                        </p>
                      </div>
                      <button
                        onClick={() => editQuantity(l)}
                        className="shrink-0 text-muted p-1.5"
                        aria-label="Edit grams"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => remove(l.id)}
                        className="shrink-0 text-muted p-1.5"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {logging && (
        <FoodLogger
          day={day}
          defaultMeal={logging}
          onLogged={() => {
            setLogging(null);
            loadDay();
          }}
          onClose={() => setLogging(null)}
        />
      )}
    </div>
  );
}
