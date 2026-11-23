"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, BookmarkPlus } from "lucide-react";
import { apiGet, apiDelete, apiPatch, apiPost } from "@/lib/api";
import { todayISO, formatDate, round, shiftISODate } from "@/lib/utils";
import { parseDecimalInput } from "@/lib/decimal-input";
import MacroSummary from "@/components/MacroSummary";
import FoodLogger from "@/components/FoodLogger";
import PageHeader from "@/components/PageHeader";
import HydrationCard from "@/components/HydrationCard";
import type { CreatinePhase } from "@/lib/hydration";
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
  currentWeightKg: number | null;
  creatineLoading: boolean;
  creatineMaintenance: boolean;
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
    currentWeightKg: null,
    creatineLoading: false,
    creatineMaintenance: false,
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

  async function changeCreatinePhase(phase: CreatinePhase) {
    setTargets((t) => ({ ...t, creatineLoading: phase === "loading", creatineMaintenance: phase === "maintenance" }));
    await apiPatch("/api/settings", { creatinePhase: phase });
  }

  async function saveMeal(meal: string, items: Log[]) {
    const name = window.prompt("Save this meal as", `${meal[0].toUpperCase()}${meal.slice(1)} favourite`);
    if (!name?.trim()) return;
    await apiPost("/api/meals", { name: name.trim(), items });
  }

  const isToday = day === todayISO();

  return (
    <div>
      <PageHeader title="Nutrition" description="Log meals, see your daily totals, and track hydration." />
      <div className="card mb-5 flex min-w-0 items-center gap-2 p-2 min-[520px]:gap-3 min-[520px]:p-3">
        <button type="button" onClick={() => setDay((d) => shiftISODate(d, -1))} className="icon-button" aria-label="Previous day">
          <ChevronLeft size={19} />
        </button>
        <label className="min-w-0 flex-1 text-center">
          <span className="sr-only">Food log date</span>
          <input
            type="date"
            value={day}
            max={todayISO()}
            onChange={(e) => { if (e.target.value && e.target.value <= todayISO()) setDay(e.target.value); }}
            className="input"
          />
        </label>
        <button type="button" onClick={() => setDay((d) => shiftISODate(d, 1))} disabled={isToday} className="icon-button disabled:opacity-45" aria-label="Next day">
          <ChevronRight size={19} />
        </button>
        {!isToday && (
          <button type="button" onClick={() => setDay(todayISO())} className="hidden min-h-11 shrink-0 px-2 text-xs font-bold text-accent min-[520px]:block">
            Back to today
          </button>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-title mb-0">{isToday ? "Today’s food log" : `Food log · ${formatDate(day)}`}</h2>
        {!isToday && <button type="button" onClick={() => setDay(todayISO())} className="min-h-11 px-2 text-xs font-bold text-accent min-[520px]:hidden">Back to today</button>}
      </div>
      <div className="grid items-start gap-5 min-[1050px]:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div>
          <MacroSummary totals={totals} targets={targets} />
          <div className="mt-4">
            <HydrationCard
              weightKg={targets.currentWeightKg}
              creatinePhase={targets.creatineLoading ? "loading" : targets.creatineMaintenance ? "maintenance" : "none"}
              onChangePhase={changeCreatinePhase}
            />
          </div>
        </div>
      <div className="flex min-w-0 flex-col gap-3">
        {MEALS.map((meal) => {
          const items = logs.filter((l) => l.meal === meal);
          const kcal = items.reduce((a, l) => a + l.calories, 0);
          return (
            <section key={meal} className="card min-w-0 p-3 min-[375px]:p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="min-w-0 flex-1 text-base font-extrabold capitalize">{meal}</h3>
                <div className="flex shrink-0 items-center gap-2 min-[360px]:gap-3">
                  {kcal > 0 && (
                    <span className="text-sm text-muted tabular-nums">
                      {round(kcal, 0)} kcal
                    </span>
                  )}
                  {items.length > 0 && (
                    <button onClick={() => saveMeal(meal, items)} className="icon-button" aria-label={`Save ${meal} as meal`}><BookmarkPlus size={17} /></button>
                  )}
                  <button
                    onClick={() => setLogging(meal)}
                    className="icon-button bg-accent-soft"
                    aria-label={`Add to ${meal}`}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              {items.length === 0 ? (
                <p className="py-2 text-xs text-muted">No foods logged</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-bold">{l.name}</p>
                        <p className="text-xs text-muted">
                          {round(l.quantityG, 0)}g · {round(l.calories, 0)} kcal
                          · {round(l.proteinG, 0)}P {round(l.carbsG, 0)}C{" "}
                          {round(l.fatG, 0)}F
                        </p>
                      </div>
                      <button
                        onClick={() => editQuantity(l)}
                        className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-accent hover:bg-surface"
                        aria-label="Edit grams"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => remove(l.id)}
                        className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-accent hover:bg-surface"
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
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
