"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Search, ScanLine, Pencil, ChevronLeft } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
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
  const [tab, setTab] = useState<"search" | "manual">("search");
  const [scanning, setScanning] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [meal, setMeal] = useState(defaultMeal);
  const [qty, setQty] = useState("100");
  const [saving, setSaving] = useState(false);

  // Manual entry fields.
  const [mName, setMName] = useState("");
  const [mKcal, setMKcal] = useState("");
  const [mP, setMP] = useState("");
  const [mC, setMC] = useState("");
  const [mF, setMF] = useState("");

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await apiGet<FoodResult[]>(
          `/api/foods/search?q=${encodeURIComponent(query.trim())}`
        );
        setResults(r);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  async function onScanned(code: string) {
    setScanning(false);
    try {
      const food = await apiGet<FoodResult>(`/api/foods/barcode/${code}`);
      setSelected(food);
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

            <button
              onClick={logSelected}
              disabled={saving}
              className="btn-primary"
            >
              Add to log
            </button>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-2 p-4 pb-0">
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

            {tab === "search" ? (
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
                  {results.map((f, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelected(f);
                        setQty("100");
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
