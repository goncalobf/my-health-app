"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Check } from "lucide-react";
import { apiGet, apiPatch, api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";

interface Targets {
  targetCalories: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const [t, setT] = useState<Targets | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiGet<Targets>("/api/settings").then(setT);
  }, []);

  async function save() {
    if (!t) return;
    await apiPatch("/api/settings", t);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function logout() {
    await api("/api/auth", { method: "DELETE" });
    router.replace("/unlock");
    router.refresh();
  }

  if (!t) return <p className="text-muted text-sm">Loading…</p>;

  const fields: { key: keyof Targets; label: string; unit: string }[] = [
    { key: "targetCalories", label: "Calories", unit: "kcal" },
    { key: "targetProteinG", label: "Protein", unit: "g" },
    { key: "targetCarbsG", label: "Carbs", unit: "g" },
    { key: "targetFatG", label: "Fat", unit: "g" },
  ];

  return (
    <div>
      <PageHeader title="Settings" back="/" />

      <h2 className="text-sm font-semibold text-muted mb-2">Daily targets</h2>
      <div className="card p-4 flex flex-col gap-3">
        {fields.map((f) => (
          <label key={f.key} className="flex items-center justify-between gap-3">
            <span className="font-medium">{f.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                className="w-24 bg-surface-2 border border-border rounded-lg px-3 py-2 text-right tabular-nums outline-none focus:border-accent"
                value={t[f.key]}
                onChange={(e) =>
                  setT({ ...t, [f.key]: Number(e.target.value) })
                }
              />
              <span className="text-xs text-muted w-8">{f.unit}</span>
            </div>
          </label>
        ))}
        <button onClick={save} className="btn-primary mt-1">
          {saved ? (
            <>
              <Check size={18} /> Saved
            </>
          ) : (
            "Save targets"
          )}
        </button>
      </div>

      <button onClick={logout} className="btn-ghost w-full mt-6">
        <LogOut size={18} /> Lock app
      </button>
    </div>
  );
}
