"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Play, Timer } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import ExercisePicker from "@/components/ExercisePicker";

interface Item {
  id: number;
  exerciseId: number;
  name: string;
  muscleGroup: string | null;
  targetSets: number;
  targetReps: number;
  minReps: number;
  maxReps: number;
  targetWeightKg: number | null;
  weightIncrementKg: number;
  restSeconds: number;
}
interface Routine {
  id: number;
  name: string;
  exercises: Item[];
}

function NumField({
  value,
  onCommit,
  suffix,
  step = 1,
  width = "w-16",
}: {
  value: number | null;
  onCommit: (v: string) => void;
  suffix?: string;
  step?: number;
  width?: string;
}) {
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => {
    setV(value == null ? "" : String(value));
  }, [value]);
  return (
    <div className="flex items-baseline gap-1">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onCommit(v)}
        className={`${width} bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-center tabular-nums outline-none focus:border-accent`}
      />
      {suffix && <span className="text-xs text-muted">{suffix}</span>}
    </div>
  );
}

export default function RoutineEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [name, setName] = useState("");
  const [picking, setPicking] = useState(false);

  async function load() {
    const r = await apiGet<Routine>(`/api/routines/${id}`);
    setRoutine(r);
    setName(r.name);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function saveName() {
    if (!name.trim() || name === routine?.name) return;
    await apiPatch(`/api/routines/${id}`, { name: name.trim() });
  }

  async function addExercise(exerciseId: number) {
    setPicking(false);
    await apiPost(`/api/routines/${id}/exercises`, { exerciseId });
    await load();
  }

  async function updateItem(itemId: number, patch: Record<string, unknown>) {
    await apiPatch(`/api/routines/${id}/exercises/${itemId}`, patch);
    setRoutine((r) =>
      r
        ? {
            ...r,
            exercises: r.exercises.map((it) =>
              it.id === itemId ? { ...it, ...patch } : it
            ),
          }
        : r
    );
  }

  async function removeItem(itemId: number) {
    await apiDelete(`/api/routines/${id}/exercises/${itemId}`);
    setRoutine((r) =>
      r ? { ...r, exercises: r.exercises.filter((it) => it.id !== itemId) } : r
    );
  }

  async function deleteRoutine() {
    if (!window.confirm("Delete this whole routine?")) return;
    await apiDelete(`/api/routines/${id}`);
    router.replace("/workouts");
  }

  async function start() {
    const created = await apiPost<{ id: number }>("/api/sessions", {
      routineId: Number(id),
    });
    router.push(`/workouts/session/${created.id}`);
  }

  if (!routine) return <p className="text-muted text-sm">Loading…</p>;

  return (
    <div>
      <PageHeader title="Edit routine" back="/workouts" />

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveName}
        className="input text-lg font-semibold mb-4"
      />

      <div className="flex flex-col gap-3">
        {routine.exercises.map((it) => (
          <div key={it.id} className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold">{it.name}</p>
                {it.muscleGroup && (
                  <p className="text-xs text-muted">{it.muscleGroup}</p>
                )}
              </div>
              <button
                onClick={() => removeItem(it.id)}
                className="text-muted p-1"
                aria-label="Remove"
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-muted">Sets</span>
                <NumField
                  value={it.targetSets}
                  onCommit={(v) =>
                    updateItem(it.id, { targetSets: Number(v) || 1 })
                  }
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-muted">Min reps</span>
                <NumField
                  value={it.minReps}
                  onCommit={(v) =>
                    updateItem(it.id, { minReps: Number(v) || 1 })
                  }
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-muted">Max reps</span>
                <NumField
                  value={it.maxReps}
                  onCommit={(v) => updateItem(it.id, { maxReps: Number(v) || 1 })}
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-muted">Weight</span>
                <NumField
                  value={it.targetWeightKg}
                  step={0.5}
                  suffix="kg"
                  onCommit={(v) => updateItem(it.id, { targetWeightKg: v })}
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-muted">Increment</span>
                <NumField
                  value={it.weightIncrementKg}
                  step={0.5}
                  suffix="kg"
                  onCommit={(v) => updateItem(it.id, { weightIncrementKg: Number(v) || 0.5 })}
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-muted flex items-center gap-1">
                  <Timer size={14} /> Rest
                </span>
                <NumField
                  value={it.restSeconds}
                  step={15}
                  suffix="s"
                  onCommit={(v) =>
                    updateItem(it.id, { restSeconds: Number(v) || 0 })
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setPicking(true)}
        className="btn-ghost w-full mt-3"
      >
        <Plus size={18} /> Add exercise
      </button>

      {routine.exercises.length > 0 && (
        <button onClick={start} className="btn-primary w-full mt-3">
          <Play size={18} /> Start this workout
        </button>
      )}

      <button
        onClick={deleteRoutine}
        className="btn-danger w-full mt-6"
      >
        <Trash2 size={18} /> Delete routine
      </button>

      {picking && (
        <ExercisePicker
          onPick={addExercise}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
