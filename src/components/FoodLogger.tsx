"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Search, ScanLine, Pencil, ChevronLeft, Star, Clock3, Utensils } from "lucide-react";
import { api, apiGet, apiPost } from "@/lib/api";
import { round } from "@/lib/utils";
import BarcodeScanner from "@/components/BarcodeScanner";

interface FoodResult {
  barcode: string | null;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servingSize: string | null;
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
    if (query.trim().length < 2) {
      setResults([]);
      setSearchError("");
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setSearchError("");
    const t = setTimeout(async () => {
      try {
        const r = await api<FoodResult[]>(
          `/api/foods/search?q=${encodeURIComponent(query.trim())}`,
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
    }, 400);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  async function onScanned(code: string) {
    setScanning(false);
    try {
      const food = await apiGet<FoodResult>(`/api/foods/barcode/${code}`);
      setSelected(food);
      setFavorited(false);
    } catch {
      // Not found — jump to manual with the barcode name hint.
      setTab("manual");
      setMName("");
    }
  }

  const factor = (Number(qty) || 0) / 100;
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
        quantityG: Number(qty) || 0,
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
    const servingMatch = selected.servingSize?.match(/[\d.]+/);
    await apiPost("/api/foods/saved", {
      name: selected.name, barcode: selected.barcode,
      servingName: selected.servingSize || null,
      servingGrams: servingMatch ? Number(servingMatch[0]) : Number(qty) || 100,
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
        quantityG: Number(qty) || 0,
        calories: Number(mKcal) || 0,
        proteinG: Number(mP) || 0,
        carbsG: Number(mC) || 0,
        fatG: Number(mF) || 0,
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
      <div className="bg-surface rounded-t-2xl border-t border-border max-h-[88vh] flex flex-col safe-bottom">
        {/* Header */}
        <div className="flex items-center gap-2 p-4 border-b border-border">
          {selected ? (
            <button
              onClick={() => setSelected(null)}
              className="text-muted p-1 -ml-1"
            >
              <ChevronLeft size={22} />
            </button>
          ) : null}
          <h3 className="font-semibold flex-1">
            {selected ? selected.name : "Add food"}
          </h3>
          <button onClick={onClose} className="text-muted p-1">
            <X size={22} />
          </button>
        </div>

        {selected ? (
          <div className="p-4 flex flex-col gap-4 overflow-y-auto">
            <div className="flex items-center gap-3">
              {selected.imageUrl && (
                <Image
                  src={selected.imageUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="rounded-lg object-cover bg-surface-2"
                  unoptimized
                />
              )}
              <div>
                {selected.brand && (
                  <p className="text-xs text-muted">{selected.brand}</p>
                )}
                <p className="text-sm text-muted">
                  Per 100g: {selected.calories} kcal · {selected.proteinG}P{" "}
                  {selected.carbsG}C {selected.fatG}F
                </p>
              </div>
            </div>

            <div>
              <label className="label">Quantity (g)</label>
              <input
                type="number"
                inputMode="decimal"
                className="input mt-1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
              {selected.servingSize && (() => {
                const match = selected.servingSize.match(/[\d.]+/);
                return match ? <button onClick={() => setQty(match[0])} className="text-xs text-accent mt-2">Use serving · {selected.servingSize}</button> : null;
              })()}
            </div>

            <MealPicker meal={meal} setMeal={setMeal} />

            {preview && (
              <div className="grid grid-cols-4 gap-2 text-center">
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
            <div className="flex gap-2 p-4 pb-0">
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
              <div className="p-4 overflow-y-auto flex flex-col gap-4">
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
              <div className="flex flex-col overflow-hidden">
                <div className="p-4">
                  <div className="relative">
                    <Search
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      autoFocus
                      className="input pl-10"
                      placeholder="Search foods (e.g. greek yogurt)"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-y-auto px-4 pb-4 flex flex-col gap-2">
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
                      key={i}
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
                          {f.brand ? `${f.brand} · ` : ""}
                          {f.calories} kcal / 100g
                        </p>
                      </div>
                    </button>
                  ))}
                  {!searching &&
                    !searchError &&
                    query.trim().length >= 2 &&
                    results.length === 0 && (
                      <p className="text-muted text-sm text-center py-4">
                        No matches. Try the Manual tab.
                      </p>
                    )}
                </div>
              </div>
            ) : (
              <div className="p-4 flex flex-col gap-3 overflow-y-auto">
                <input
                  className="input"
                  placeholder="Food name"
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
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
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border ${
        active
          ? "bg-accent text-bg border-accent"
          : "bg-surface-2 text-muted border-border"
      }`}
    >
      {icon}
      {label}
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
      <div className="flex gap-2 mt-1">
        {MEALS.map((m) => (
          <button
            key={m}
            onClick={() => setMeal(m)}
            className={`flex-1 py-2 rounded-lg text-sm capitalize border ${
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
    <div className="bg-surface-2 rounded-lg py-2">
      <p className="text-lg font-bold tabular-nums">{value}</p>
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
        type="number"
        inputMode="decimal"
        className="input"
        value={v}
        onChange={(e) => set(e.target.value)}
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
