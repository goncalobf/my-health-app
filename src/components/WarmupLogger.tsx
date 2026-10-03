"use client";
import { useRef, useState } from "react";
import { normalizeDecimalInput } from "@/lib/decimal-input";
export default function WarmupLogger({
  onLog,
  logged,
}: {
  onLog: (
    weight: string,
    reps: string,
    clientRequestId: string,
  ) => Promise<void>;
  logged: { weightKg: number; reps: number }[];
}) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const saving = useRef(false);
  async function save() {
    if (saving.current) return;
    saving.current = true;
    requestId.current ??= crypto.randomUUID();
    setBusy(true);
    setError("");
    try {
      await onLog(weight, reps, requestId.current);
      requestId.current = null;
      setReps("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log warm-up");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <details className="card mb-3 p-3">
      <summary className="cursor-pointer py-2 text-sm">
        Warm-up sets · {logged.length} logged
      </summary>
      <p className="my-2 text-xs text-muted">
        Warm-ups stay separate from working sets and progression.
      </p>
      {logged.map((s, i) => (
        <p key={i} className="text-xs text-muted">
          {s.weightKg} kg × {s.reps}
        </p>
      ))}
      <fieldset disabled={busy} className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Warm-up kg
          <input
            className="input mt-1"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(normalizeDecimalInput(e.target.value))}
          />
        </label>
        <label className="text-xs text-muted">
          Warm-up reps
          <input
            className="input mt-1"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value.replace(/[^\d]/g, ""))}
          />
        </label>
        <button
          className="btn-ghost col-span-2"
          onClick={save}
          disabled={!weight.trim() || !Number(reps)}
        >
          {busy ? "Saving…" : "Log warm-up"}
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </details>
  );
}
