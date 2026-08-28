"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, BookmarkPlus } from "lucide-react";
import { apiGet, apiDelete, apiPatch, apiPost } from "@/lib/api";
import { todayISO, formatDate, round, shiftISODate } from "@/lib/utils";
import MacroSummary from "@/components/MacroSummary";
import FoodLogger from "@/components/FoodLogger";

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
    if (next == null || !Number(next) || Number(next) <= 0) return;
    await apiPatch(`/api/nutrition/${log.id}`, { quantityG: Number(next) });
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
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setDay((d) => shiftISODate(d, -1))}
          className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-muted"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold">
            {isToday ? "Today" : formatDate(day)}
          </h1>
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
          className="w-10 h-10 rounded-full bg-surface-2 border border-border flex items-center justify-center text-muted disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <MacroSummary totals={totals} targets={targets} />

      <div className="flex flex-col gap-4 mt-5">
        {MEALS.map((meal) => {
          const items = logs.filter((l) => l.meal === meal);
          const kcal = items.reduce((a, l) => a + l.calories, 0);
          return (
            <div key={meal}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold capitalize">{meal}</h2>
                <div className="flex items-center gap-3">
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
                    className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center"
                    aria-label={`Add to ${meal}`}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-muted pl-1">Nothing logged</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((l) => (
                    <div
                      key={l.id}
                      className="card px-3 py-2.5 flex items-center gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{l.name}</p>
                        <p className="text-xs text-muted">
                          {round(l.quantityG, 0)}g · {round(l.calories, 0)} kcal
                          · {round(l.proteinG, 0)}P {round(l.carbsG, 0)}C{" "}
                          {round(l.fatG, 0)}F
                        </p>
                      </div>
                      <button
                        onClick={() => editQuantity(l)}
                        className="text-muted p-1.5"
                        aria-label="Edit grams"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => remove(l.id)}
                        className="text-muted p-1.5"
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
