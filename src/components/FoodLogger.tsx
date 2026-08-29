"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { X, Search, ScanLine, Pencil, ChevronLeft, Star, Clock3, Utensils } from "lucide-react";
import { api, apiGet, apiPost } from "@/lib/api";
import { round } from "@/lib/utils";
import { normalizeDecimalInput, parseDecimalInput } from "@/lib/decimal-input";
import BarcodeScanner from "@/components/BarcodeScanner";

interface FoodResult {
  id?: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingSize: string | null;
  source?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  attribution?: string | null;
  sourceVersion?: string | null;
}

interface SavedFood {
  id?: number; name: string; barcode: string | null; servingName: string | null;
  servingGrams: number; caloriesPer100: number; proteinPer100: number;
  carbsPer100: number; fatPer100: number;
}
interface MealTemplate { id: number; name: string; items: { name: string }[]; }

const MEALS = ["breakfast", "lunch", "dinner", "snack"];

export default function FoodLogger({
  day,
  defaultMeal,
  onLogged,
  onClose,
}: {
  day: string;
  defaultMeal: string;
  onLogged: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"quick" | "search" | "manual">("quick");
  const [scanning, setScanning] = useState(false);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchNonce, setSearchNonce] = useState(0);
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [meal, setMeal] = useState(defaultMeal);
  const [qty, setQty] = useState("100");
  const [saving, setSaving] = useState(false);
  const [quick, setQuick] = useState<{ favorites: SavedFood[]; recent: SavedFood[] }>({ favorites: [], recent: [] });
  const [meals, setMeals] = useState<MealTemplate[]>([]);
  const [favorited, setFavorited] = useState(false);

  // Manual entry fields.
  const [mName, setMName] = useState("");
  const [mKcal, setMKcal] = useState("");
  const [mP, setMP] = useState("");
  const [mC, setMC] = useState("");
  const [mF, setMF] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet<{ favorites: SavedFood[]; recent: SavedFood[] }>("/api/foods/saved"),
      apiGet<MealTemplate[]>("/api/meals"),
    ]).then(([foods, templates]) => { setQuick(foods); setMeals(templates); });
  }, []);

  useEffect(() => {
    if (submittedQuery.trim().length < 3) {
      setResults([]);
      setSearchError("");
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setSearchError("");
    (async () => {
      try {
        const r = await api<FoodResult[]>(
          `/api/foods/search?q=${encodeURIComponent(submittedQuery.trim())}`,
          { signal: controller.signal }
        );
        setResults(r);
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchError(
            error instanceof Error ? error.message : "Food search failed."
          );
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    })();
    return () => {
      controller.abort();
    };
  }, [submittedQuery, searchNonce]);

  const onScanned = useCallback(async (code: string) => {
    try {
      const food = await apiGet<FoodResult>(`/api/foods/barcode/${code}`);
      setSelected(food);
      setFavorited(false);
    } catch {
      // Not found — jump to manual with the barcode name hint.
      setTab("manual");
      setMName("");
    } finally {
      setScanning(false);
    }
  }, []);

  const factor = parseDecimalInput(qty) / 100;
  const preview = selected
    ? {
        calories: round(selected.calories * factor, 0),
        proteinG: round(selected.proteinG * factor, 1),
        carbsG: round(selected.carbsG * factor, 1),
        fatG: round(selected.fatG * factor, 1),
      }
    : null;

  async function logSelected() {
    if (!selected || !preview) return;
    setSaving(true);
    try {
      await apiPost("/api/nutrition", {
        day,
        meal,
        name: selected.name,
        barcode: selected.barcode,
        quantityG: parseDecimalInput(qty),
        ...preview,
      });
      onLogged();
    } finally {
      setSaving(false);
    }
  }

  function chooseQuick(food: SavedFood) {
    setSelected({
      barcode: food.barcode, name: food.name, brand: null, imageUrl: null,
      calories: food.caloriesPer100, proteinG: food.proteinPer100,
      carbsG: food.carbsPer100, fatG: food.fatPer100,
      servingSize: food.servingName ? `${food.servingGrams}g ${food.servingName}` : `${food.servingGrams}g`,
    });
    setQty(String(food.servingGrams));
    setFavorited(!!food.id);
  }

  async function saveFavorite() {
    if (!selected) return;
    const servingMatch = selected.servingSize?.match(/[\d.,]+/);
    await apiPost("/api/foods/saved", {
      name: selected.name, barcode: selected.barcode,
      servingName: selected.servingSize || null,
      servingGrams: servingMatch
        ? Number(servingMatch[0].replace(",", "."))
        : parseDecimalInput(qty) || 100,
      caloriesPer100: selected.calories, proteinPer100: selected.proteinG,
      carbsPer100: selected.carbsG, fatPer100: selected.fatG,
    });
    setFavorited(true);
  }

  async function logMeal(templateId: number) {
    setSaving(true);
    try {
      await apiPost("/api/meals", { logTemplateId: templateId, day, meal });
      onLogged();
    } finally { setSaving(false); }
  }

  async function logManual() {
    if (!mName.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/nutrition", {
        day,
        meal,
        name: mName.trim(),
        quantityG: parseDecimalInput(qty),
        calories: parseDecimalInput(mKcal),
        proteinG: parseDecimalInput(mP),
        carbsG: parseDecimalInput(mC),
        fatG: parseDecimalInput(mF),
      });
      onLogged();
    } finally {
      setSaving(false);
    }
  }

  if (scanning) {
    return (
      <BarcodeScanner
        onDetected={onScanned}
        onClose={() => setScanning(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
      <div className="mx-auto flex max-h-[calc(100dvh_-_env(safe-area-inset-top))] w-full max-w-lg flex-col rounded-t-2xl border-t border-border bg-surface safe-bottom">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 p-4 border-b border-border">
          {selected ? (
            <button
              onClick={() => setSelected(null)}
              className="text-muted p-1 -ml-1"
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}
          <h3 className="min-w-0 flex-1 truncate font-semibold">
            {selected ? selected.name : "Add food"}
          </h3>
          <button onClick={onClose} className="text-muted p-1">
            <X size={22} />
          </button>
        </div>

        {selected ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {selected.imageUrl && (
                <Image
                  src={selected.imageUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="shrink-0 rounded-lg object-cover bg-surface-2"
                  unoptimized
                />
              )}
              <div className="min-w-0">
                {selected.source && (
                  <p className="text-[11px] font-medium text-accent">{selected.source}</p>
                )}
                {selected.brand && (
                  <p className="text-xs text-muted">{selected.brand}</p>
                )}
                <p className="break-words text-sm text-muted">
                  Per 100g: {selected.calories} kcal · {selected.proteinG}P{" "}
                  {selected.carbsG}C {selected.fatG}F
                </p>
                {selected.sourceUrl && (
                  <a
                    href={selected.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block text-[11px] text-muted underline underline-offset-2"
                  >
                    {selected.attribution ?? "View source"}
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="label">Quantity (g)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                className="input mt-1"
                value={qty}
                onChange={(e) => setQty(normalizeDecimalInput(e.target.value))}
              />
              {selected.servingSize && (() => {
                const match = selected.servingSize.match(/[\d.,]+/);
                return match ? <button onClick={() => setQty(match[0].replace(",", "."))} className="text-xs text-accent mt-2">Use serving · {selected.servingSize}</button> : null;
              })()}
            </div>

            <MealPicker meal={meal} setMeal={setMeal} />

            {preview && (
              <div className="grid grid-cols-4 gap-1.5 text-center min-[360px]:gap-2">
                <Stat label="kcal" value={preview.calories} />
                <Stat label="P" value={preview.proteinG} />
                <Stat label="C" value={preview.carbsG} />
                <Stat label="F" value={preview.fatG} />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={saveFavorite} disabled={favorited} className="btn-ghost px-3" aria-label="Save favourite"><Star size={18} fill={favorited ? "currentColor" : "none"} /></button>
              <button onClick={logSelected} disabled={saving} className="btn-primary flex-1">Add to log</button>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="shrink-0 grid grid-cols-4 gap-1.5 p-3 pb-0 min-[360px]:gap-2 min-[360px]:p-4 min-[360px]:pb-0">
              <TabBtn
                active={tab === "quick"}
                onClick={() => setTab("quick")}
                icon={<Clock3 size={16} />}
                label="Quick"
              />
              <TabBtn
                active={tab === "search"}
                onClick={() => setTab("search")}
                icon={<Search size={16} />}
                label="Search"
              />
              <TabBtn
                active={false}
                onClick={() => setScanning(true)}
                icon={<ScanLine size={16} />}
                label="Scan"
              />
              <TabBtn
                active={tab === "manual"}
                onClick={() => setTab("manual")}
                icon={<Pencil size={16} />}
                label="Manual"
              />
            </div>

            {tab === "quick" ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {meals.length > 0 && <QuickSection title="Saved meals" icon={<Utensils size={15} />}>
                  {meals.map((m) => <button key={m.id} onClick={() => logMeal(m.id)} disabled={saving} className="card px-3 py-3 text-left">
                    <p className="font-medium">{m.name}</p><p className="text-xs text-muted">{m.items.map((x) => x.name).join(" · ")}</p>
                  </button>)}
                </QuickSection>}
                {quick.favorites.length > 0 && <QuickSection title="Favourites" icon={<Star size={15} />}>
                  {quick.favorites.map((f) => <QuickFood key={f.id} food={f} onClick={() => chooseQuick(f)} />)}
                </QuickSection>}
                {quick.recent.length > 0 && <QuickSection title="Recent" icon={<Clock3 size={15} />}>
                  {quick.recent.map((f, i) => <QuickFood key={`${f.name}-${i}`} food={f} onClick={() => chooseQuick(f)} />)}
                </QuickSection>}
                {!meals.length && !quick.favorites.length && !quick.recent.length && <p className="text-sm text-muted text-center py-8">Recent foods, favourites and saved meals will appear here.</p>}
              </div>
            ) : tab === "search" ? (
              <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
                <div className="p-4">
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const nextQuery = query.trim();
                      if (nextQuery.length < 3) return;
                      setResults([]);
                      setSearchError("");
                      setSubmittedQuery(nextQuery);
                      setSearchNonce((value) => value + 1);
                    }}
                  >
                    <div className="relative min-w-0 flex-1">
                      <Search
                        size={18}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                      />
                      <input
                        autoFocus
                        className="input pl-10"
                        placeholder="Search foods (e.g. cooked white rice)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn-primary shrink-0 px-4"
                      disabled={query.trim().length < 3 || searching}
                    >
                      Search
                    </button>
                  </form>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-2">
                  {searching && (
                    <p className="text-muted text-sm text-center py-2">
                      Searching…
                    </p>
                  )}
                  {searchError && (
                    <p className="text-danger text-sm text-center py-2">
                      {searchError}
                    </p>
                  )}
                  {results.map((f, i) => (
                    <button
                      key={f.id ?? `${f.source}-${f.barcode ?? f.name}-${i}`}
                      onClick={() => {
                        setSelected(f);
                        setQty("100");
                        setFavorited(false);
                      }}
                      className="card px-3 py-2.5 flex items-center gap-3 text-left active:scale-[0.98] transition"
                    >
                      {f.imageUrl && (
                        <Image
                          src={f.imageUrl}
                          alt=""
                          width={40}
                          height={40}
                          className="rounded-md object-cover bg-surface-2 shrink-0"
                          unoptimized
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted truncate">
                          {f.source ? `${f.source} · ` : ""}
                          {f.brand ? `${f.brand} · ` : ""}
                          {f.calories} kcal / 100g
                        </p>
                      </div>
                    </button>
                  ))}
                  {!searching &&
                    !searchError &&
                    submittedQuery.trim().length >= 3 &&
                    results.length === 0 && (
                      <p className="text-muted text-sm text-center py-4">
                        No matches. Try the Manual tab.
                      </p>
                    )}
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <input
                  className="input"
                  placeholder="Food name"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                />
                <div className="grid grid-cols-1 gap-3 min-[340px]:grid-cols-2">
                  <Field label="Calories" v={mKcal} set={setMKcal} />
                  <Field label="Quantity (g)" v={qty} set={setQty} />
                  <Field label="Protein (g)" v={mP} set={setMP} />
                  <Field label="Carbs (g)" v={mC} set={setMC} />
                  <Field label="Fat (g)" v={mF} set={setMF} />
                </div>
                <MealPicker meal={meal} setMeal={setMeal} />
                <button
                  onClick={logManual}
                  disabled={saving || !mName.trim()}
                  className="btn-primary"
                >
                  Add to log
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-1 py-2 text-xs font-medium min-[360px]:text-sm ${
        active
          ? "bg-accent text-bg border-accent"
          : "bg-surface-2 text-muted border-border"
      }`}
    >
      {icon}
      <span className="hidden min-[340px]:inline">{label}</span>
    </button>
  );
}

function MealPicker({
  meal,
  setMeal,
}: {
  meal: string;
  setMeal: (m: string) => void;
}) {
  return (
    <div>
      <label className="label">Meal</label>
      <div className="mt-1 grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
        {MEALS.map((m) => (
          <button
            key={m}
            onClick={() => setMeal(m)}
            className={`min-w-0 rounded-lg border py-2 text-sm capitalize ${
              meal === m
                ? "bg-accent text-bg border-accent"
                : "bg-surface-2 text-muted border-border"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-2 py-2">
      <p className="truncate text-base font-bold tabular-nums min-[360px]:text-lg">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function Field({
  label,
  v,
  set,
}: {
  label: string;
  v: string;
  set: (s: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.,]?[0-9]*"
        className="input"
        value={v}
        onChange={(e) => set(normalizeDecimalInput(e.target.value))}
      />
    </label>
  );
}

function QuickSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section><h4 className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5 mb-2">{icon}{title}</h4><div className="flex flex-col gap-2">{children}</div></section>;
}

function QuickFood({ food, onClick }: { food: SavedFood; onClick: () => void }) {
  return <button onClick={onClick} className="card px-3 py-2.5 text-left active:scale-[0.98] transition">
    <p className="font-medium truncate">{food.name}</p>
    <p className="text-xs text-muted">{round(food.caloriesPer100, 0)} kcal / 100g · default {round(food.servingGrams, 0)}g</p>
  </button>;
}
