"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Play, Timer, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import ExercisePicker from "@/components/ExercisePicker";
import ExerciseImage from "@/components/ExerciseImage";

interface Item {
  id: number;
  exerciseId: number;
  name: string;
  muscleGroup: string | null;
  imageUrl: string | null;
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

function SortableExerciseCard({
  item,
  onUpdate,
  onRemove,
}: {
  item: Item;
  onUpdate: (itemId: number, patch: Record<string, unknown>) => void;
  onRemove: (itemId: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card p-3 min-[360px]:p-4 ${isDragging ? "z-10 opacity-90" : ""}`}
    >
      <div className="mb-3 flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 flex h-9 w-8 shrink-0 touch-none items-center justify-center text-muted active:cursor-grabbing"
          aria-label={`Reorder ${item.name}`}
        >
          <GripVertical size={18} />
        </button>
        <ExerciseImage
          name={item.name}
          imageUrl={item.imageUrl}
          className="h-14 w-14"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{item.name}</p>
          {item.muscleGroup && (
            <p className="text-xs text-muted">{item.muscleGroup}</p>
          )}
        </div>
        <button
          onClick={() => onRemove(item.id)}
          className="shrink-0 p-1 text-muted"
          aria-label="Remove"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 min-[400px]:gap-3">
        <label className="flex min-w-0 items-center justify-between gap-2">
          <span className="text-sm text-muted">Sets</span>
          <NumField
            value={item.targetSets}
            onCommit={(v) => onUpdate(item.id, { targetSets: Number(v) || 1 })}
          />
        </label>
        <label className="flex min-w-0 items-center justify-between gap-2">
          <span className="text-sm text-muted">Min reps</span>
          <NumField
            value={item.minReps}
            onCommit={(v) => onUpdate(item.id, { minReps: Number(v) || 1 })}
          />
        </label>
        <label className="flex min-w-0 items-center justify-between gap-2">
          <span className="text-sm text-muted">Max reps</span>
          <NumField
            value={item.maxReps}
            onCommit={(v) => onUpdate(item.id, { maxReps: Number(v) || 1 })}
          />
        </label>
        <label className="flex min-w-0 items-center justify-between gap-2">
          <span className="text-sm text-muted">Weight</span>
          <NumField
            value={item.targetWeightKg}
            step={0.5}
            suffix="kg"
            onCommit={(v) => onUpdate(item.id, { targetWeightKg: v })}
          />
        </label>
        <label className="flex min-w-0 items-center justify-between gap-2">
          <span className="text-sm text-muted">Increment</span>
          <NumField
            value={item.weightIncrementKg}
            step={0.5}
            suffix="kg"
            onCommit={(v) =>
              onUpdate(item.id, { weightIncrementKg: Number(v) || 0.5 })
            }
          />
        </label>
        <label className="flex min-w-0 items-center justify-between gap-2">
          <span className="text-sm text-muted flex items-center gap-1">
            <Timer size={14} /> Rest
          </span>
          <NumField
            value={item.restSeconds}
            step={15}
            suffix="s"
            onCommit={(v) => onUpdate(item.id, { restSeconds: Number(v) || 0 })}
          />
        </label>
      </div>
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const load = useCallback(async () => {
    const r = await apiGet<Routine>(`/api/routines/${id}`);
    setRoutine(r);
    setName(r.name);
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !routine) return;
    const oldIndex = routine.exercises.findIndex((it) => it.id === active.id);
    const newIndex = routine.exercises.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(routine.exercises, oldIndex, newIndex);
    setRoutine({ ...routine, exercises: reordered });
    await apiPatch(`/api/routines/${id}/exercises`, {
      order: reordered.map((it) => it.id),
    });
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={routine.exercises.map((it) => it.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {routine.exercises.map((it) => (
              <SortableExerciseCard
                key={it.id}
                item={it}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
