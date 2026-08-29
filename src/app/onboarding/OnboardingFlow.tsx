"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { apiPost } from "@/lib/api";
import { normalizeDecimalInput } from "@/lib/decimal-input";
import type { BiologicalSex, Goal } from "@/lib/calorie-targets";

const GOALS: { value: Goal; label: string; detail: string }[] = [
  { value: "fat_loss", label: "Lose fat", detail: "Hold strength, drop weight" },
  {
    value: "recomposition",
    label: "Lose fat + gain muscle",
    detail: "Slow cut while training hard",
  },
  { value: "maintenance", label: "Maintain", detail: "Stay where you are" },
  { value: "muscle_gain", label: "Gain muscle", detail: "Controlled surplus" },
];

const SEXES: { value: BiologicalSex; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unspecified", label: "Prefer not to say" },
];

export default function OnboardingFlow({ name }: { name: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [currentWeightKg, setCurrentWeightKg] = useState("");
  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [ageYears, setAgeYears] = useState("");
  const [biologicalSex, setBiologicalSex] = useState<BiologicalSex | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const bodyComplete =
    currentWeightKg.trim() !== "" &&
    heightCm.trim() !== "" &&
    ageYears.trim() !== "" &&
    biologicalSex !== null;

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await apiPost("/api/onboarding", {
        goal,
        currentWeightKg: Number(normalizeDecimalInput(currentWeightKg)),
        goalWeightKg: goalWeightKg.trim()
          ? Number(normalizeDecimalInput(goalWeightKg))
          : null,
        heightCm: Number(normalizeDecimalInput(heightCm)),
        ageYears: Number(normalizeDecimalInput(ageYears)),
        biologicalSex,
      });
      router.replace("/");
      router.refresh();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not save your setup."
      );
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pb-8 pt-6 safe-top safe-bottom">
      <div className="mb-6 flex items-center gap-2">
        {[0, 1].map((index) => (
          <div
            key={index}
            className={`h-1 flex-1 transition ${
              index <= step ? "bg-accent" : "bg-surface-2"
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-6 h-16 w-16 overflow-hidden border border-border bg-black [border-radius:2px_14px_2px_2px]">
            <Image src="/icons/icon-192.png" alt="Fitlog" width={64} height={64} priority />
          </div>
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-accent">Fitlog / initialization</p>
          <h1 className="font-display text-4xl leading-none tracking-[0.04em] min-[360px]:text-5xl">
            {name ? `Welcome, ${name.split(" ")[0]}.` : "Welcome to Fitlog."}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            One question first. What are you training for? This sets your
            calories and macros, and you can change it any time in settings.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            {GOALS.map((option) => {
              const selected = goal === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setGoal(option.value)}
                  aria-pressed={selected}
                  className={`card flex items-center gap-3 p-4 text-left transition active:scale-[0.99] ${
                    selected ? "border-accent bg-accent/10" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl tracking-[0.04em]">{option.label}</p>
                    <p className="text-xs text-muted">{option.detail}</p>
                  </div>
                  {selected && (
                    <Check size={19} className="shrink-0 text-accent" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep(1)}
            disabled={!goal}
            className="btn-primary mt-auto w-full py-3.5 text-base"
          >
            Continue <ArrowRight size={19} />
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-accent">Fitlog / body profile</p>
          <h1 className="font-display text-4xl leading-none tracking-[0.04em] min-[360px]:text-5xl">About you</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Used to estimate your energy needs. Nothing here leaves your account.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <Field
              label="Current weight"
              unit="kg"
              value={currentWeightKg}
              onChange={setCurrentWeightKg}
            />
            <Field
              label="Height"
              unit="cm"
              value={heightCm}
              onChange={setHeightCm}
            />
            <Field
              label="Age"
              unit="years"
              value={ageYears}
              onChange={setAgeYears}
            />
            {goal !== "maintenance" && (
              <Field
                label="Goal weight"
                unit="kg"
                optional
                value={goalWeightKg}
                onChange={setGoalWeightKg}
              />
            )}

            <div>
              <span className="label">Biological sex</span>
              <div className="mt-1.5 flex gap-1.5">
                {SEXES.map((option) => {
                  const selected = biologicalSex === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setBiologicalSex(option.value)}
                      aria-pressed={selected}
                      className={`min-w-0 flex-1 rounded-xl px-2 py-2.5 text-xs font-medium transition active:scale-95 ${
                        selected
                          ? "bg-accent text-bg"
                          : "border border-border bg-surface-2 text-muted"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-danger">{error}</p>}

          <div className="mt-auto flex gap-2 pt-6">
            <button
              onClick={() => setStep(0)}
              className="btn-ghost h-12 w-12 shrink-0 px-0 py-0"
              aria-label="Back to goal"
            >
              <ArrowLeft size={19} />
            </button>
            <button
              onClick={finish}
              disabled={!bodyComplete || busy}
              className="btn-primary min-w-0 flex-1 py-3.5 text-base"
            >
              {busy ? "Setting up…" : "Start training"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  unit,
  value,
  optional = false,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  optional?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 min-[360px]:gap-3">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {optional && <span className="text-xs text-muted">Optional</span>}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <input
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(normalizeDecimalInput(event.target.value))}
          aria-label={`${label} in ${unit}`}
          className="w-24 input text-right"
        />
        <span className="w-9 text-xs text-muted">{unit}</span>
      </div>
    </label>
  );
}
