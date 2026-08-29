"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2, Flag, X, Dumbbell } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import ExercisePicker from "@/components/ExercisePicker";
import ExerciseImage from "@/components/ExerciseImage";
import RestTimer from "@/components/RestTimer";

interface PlanItem {
  exerciseId: number;
  name: string;
  imageUrl: string | null;
  targetSets: number;
  targetReps: number;
  minReps: number;
  maxReps: number;
  targetWeightKg: number | null;
  weightIncrementKg: number;
  restSeconds: number;
  targetRirMin: number | null;
  targetRirMax: number | null;
  avoidFailure: boolean;
  instruction: string | null;
  supersetGroup: string | null;
  isAnchor: boolean;
  deloadMode: boolean;
}
interface LoggedSet {
  id: number;
  exerciseId: number;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir: number | null;
  isWarmup: boolean;
  completedAt: string | null;
}
interface SessionData {
  session: { id: number; name: string; startedAt: string; finishedAt: string | null };
  plan: PlanItem[];
  loggedSets: LoggedSet[];
  lastSets: Record<number, { weightKg: number; reps: number; rir: number | null }[]>;
  recommendations: Record<number, {
    action: "start" | "increase" | "repeat" | "reduce";
    weightKg: number | null;
    message: string;
    reason: string;
  }>;
}

interface LocalSet {
  key: string;
  dbId?: number;
  weight: string;
  reps: string;
  rir: string;
  completed: boolean;
}
interface Block {
  exerciseId: number;
  name: string;
  imageUrl: string | null;
  targetReps: number;
  minReps: number;
  maxReps: number;
  restSeconds: number;
  targetRirMin: number | null;
  targetRirMax: number | null;
  avoidFailure: boolean;
  instruction: string | null;
  supersetGroup: string | null;
  isAnchor: boolean;
  deloadMode: boolean;
  lastSets: { weightKg: number; reps: number; rir: number | null }[];
  recommendation?: SessionData["recommendations"][number];
  sets: LocalSet[];
}

let keyc = 0;
const nk = () => `s${keyc++}`;

function rirTarget(min: number | null, max: number | null) {
  if (min == null) return null;
  return min === max || max == null ? `RIR ${min}` : `RIR ${min}–${max}`;
}

export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [rest, setRest] = useState<{
    startedAt: number;
    target: number;
    label: string;
  } | null>(null);

  const load = useCallback(async () => {
    const [data, exercises] = await Promise.all([
      apiGet<SessionData>(`/api/sessions/${id}`),
      apiGet<{ id: number; name: string; imageUrl: string | null }[]>(
        "/api/exercises"
      ),
    ]);
    const exMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
    if (data.session.finishedAt) {
      router.replace(`/workouts/session/${id}/summary`);
      return;
    }
    setName(data.session.name);

    const built: Block[] = [];
    const seen = new Set<number>();

    const makeBlock = (
      exerciseId: number,
      opts: {
        name: string;
        imageUrl: string | null;
        targetSets: number;
        targetReps: number;
        minReps: number;
        maxReps: number;
        restSeconds: number;
        targetRirMin: number | null;
        targetRirMax: number | null;
        avoidFailure: boolean;
        instruction: string | null;
        supersetGroup: string | null;
        isAnchor: boolean;
        deloadMode: boolean;
      }
    ): Block => {
      const logged = data.loggedSets
        .filter((s) => s.exerciseId === exerciseId)
        .sort((a, b) => a.setNumber - b.setNumber);
      const last = data.lastSets[exerciseId] ?? [];
      let sets: LocalSet[];
      if (logged.length) {
        sets = logged.map((s) => ({
          key: nk(),
          dbId: s.id,
          weight: s.weightKg ? String(s.weightKg) : "",
          reps: s.reps ? String(s.reps) : "",
          rir: s.rir == null ? "" : String(s.rir),
          completed: !!s.completedAt,
        }));
      } else {
        const count = Math.max(1, opts.targetSets);
        sets = Array.from({ length: count }, (_, i) => ({
          key: nk(),
          weight: data.recommendations[exerciseId]?.weightKg != null
            ? String(data.recommendations[exerciseId].weightKg)
            : last[i]?.weightKg ? String(last[i].weightKg) : "",
          reps: last[i]?.reps ? String(last[i].reps) : String(opts.minReps),
          rir: "",
          completed: false,
        }));
      }
      return {
        exerciseId,
        name: opts.name,
        imageUrl: opts.imageUrl,
        targetReps: opts.targetReps,
        minReps: opts.minReps,
        maxReps: opts.maxReps,
        restSeconds: opts.restSeconds,
        targetRirMin: opts.targetRirMin,
        targetRirMax: opts.targetRirMax,
        avoidFailure: opts.avoidFailure,
        instruction: opts.instruction,
        supersetGroup: opts.supersetGroup,
        isAnchor: opts.isAnchor,
        deloadMode: opts.deloadMode,
        lastSets: last,
        recommendation: data.recommendations[exerciseId],
        sets,
      };
    };

    for (const p of data.plan) {
      seen.add(p.exerciseId);
      built.push(
        makeBlock(p.exerciseId, {
          name: p.name,
          imageUrl: p.imageUrl,
          targetSets: p.targetSets,
          targetReps: p.targetReps,
          minReps: p.minReps,
          maxReps: p.maxReps,
          restSeconds: p.restSeconds,
          targetRirMin: p.targetRirMin,
          targetRirMax: p.targetRirMax,
          avoidFailure: p.avoidFailure,
          instruction: p.instruction,
          supersetGroup: p.supersetGroup,
          isAnchor: p.isAnchor,
          deloadMode: p.deloadMode,
        })
      );
    }
    for (const s of data.loggedSets) {
      if (seen.has(s.exerciseId)) continue;
      seen.add(s.exerciseId);
      const exercise = exMap.get(s.exerciseId);
      built.push(
        makeBlock(s.exerciseId, {
          name: exercise?.name ?? "Exercise",
          imageUrl: exercise?.imageUrl ?? null,
          targetSets: 1,
          targetReps: 0,
          minReps: 0,
          maxReps: 0,
          restSeconds: 120,
          targetRirMin: null,
          targetRirMax: null,
          avoidFailure: false,
          instruction: null,
          supersetGroup: null,
          isAnchor: false,
          deloadMode: false,
        })
      );
    }

    setBlocks(built);
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  function patchSet(exIdx: number, setKey: string, patch: Partial<LocalSet>) {
    setBlocks((bs) =>
      bs.map((b, i) =>
        i === exIdx
          ? {
              ...b,
              sets: b.sets.map((s) =>
                s.key === setKey ? { ...s, ...patch } : s
              ),
            }
          : b
      )
    );
  }

  async function commitValues(exIdx: number, s: LocalSet) {
    if (!s.dbId) return;
    await apiPatch(`/api/sessions/${id}/sets/${s.dbId}`, {
      weightKg: Number(s.weight) || 0,
      reps: Number(s.reps) || 0,
      rir: s.rir,
    });
  }

  async function toggleComplete(exIdx: number, setKey: string) {
    const block = blocks[exIdx];
    const idx = block.sets.findIndex((s) => s.key === setKey);
    const s = block.sets[idx];
    const nextCompleted = !s.completed;

    if (!s.dbId) {
      const created = await apiPost<{ id: number }>(
        `/api/sessions/${id}/sets`,
        {
          exerciseId: block.exerciseId,
          setNumber: idx + 1,
          weightKg: Number(s.weight) || 0,
          reps: Number(s.reps) || 0,
          rir: s.rir,
          completed: nextCompleted,
        }
      );
      patchSet(exIdx, setKey, { dbId: created.id, completed: nextCompleted });
    } else {
      await apiPatch(`/api/sessions/${id}/sets/${s.dbId}`, {
        weightKg: Number(s.weight) || 0,
        reps: Number(s.reps) || 0,
        rir: s.rir,
        completed: nextCompleted,
      });
      patchSet(exIdx, setKey, { completed: nextCompleted });
    }

    if (nextCompleted) {
      setRest({
        startedAt: Date.now(),
        target: block.restSeconds,
        label: block.name,
      });
    }
  }

  function addSet(exIdx: number) {
    setBlocks((bs) =>
      bs.map((b, i) => {
        if (i !== exIdx) return b;
        const prev = b.sets[b.sets.length - 1];
        return {
          ...b,
          sets: [
            ...b.sets,
            {
              key: nk(),
              weight: prev?.weight ?? "",
              reps: prev?.reps ?? (b.minReps ? String(b.minReps) : ""),
              rir: "",
              completed: false,
            },
          ],
        };
      })
    );
  }

  async function removeSet(exIdx: number, setKey: string) {
    const s = blocks[exIdx].sets.find((x) => x.key === setKey);
    if (s?.dbId) await apiDelete(`/api/sessions/${id}/sets/${s.dbId}`);
    setBlocks((bs) =>
      bs.map((b, i) =>
        i === exIdx
          ? { ...b, sets: b.sets.filter((x) => x.key !== setKey) }
          : b
      )
    );
  }

  async function addExercise(exerciseId: number) {
    setPicking(false);
    const exercises = await apiGet<
      { id: number; name: string; imageUrl: string | null }[]
    >("/api/exercises");
    const ex = exercises.find((e) => e.id === exerciseId);
    setBlocks((bs) => [
      ...bs,
      {
        exerciseId,
        name: ex?.name ?? "Exercise",
        imageUrl: ex?.imageUrl ?? null,
        targetReps: 0,
        minReps: 0,
        maxReps: 0,
        restSeconds: 120,
        targetRirMin: null,
        targetRirMax: null,
        avoidFailure: false,
        instruction: null,
        supersetGroup: null,
        isAnchor: false,
        deloadMode: false,
        lastSets: [],
        recommendation: undefined,
        sets: [{ key: nk(), weight: "", reps: "", rir: "", completed: false }],
      },
    ]);
  }

  async function finish() {
    await apiPatch(`/api/sessions/${id}`, { finish: true });
    router.replace(`/workouts/session/${id}/summary`);
  }

  async function discard() {
    if (!window.confirm("Discard this workout and all its sets?")) return;
    await apiDelete(`/api/sessions/${id}`);
    router.replace("/workouts");
  }

  const completedCount = blocks.reduce(
    (a, b) => a + b.sets.filter((s) => s.completed).length,
    0
  );
  const totalSets = blocks.reduce((total, block) => total + block.sets.length, 0);
  const progress = totalSets ? Math.round((completedCount / totalSets) * 100) : 0;

  if (loading) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-muted">Loading your workout…</p>
      </div>
    );
  }

  return (
    <div className={rest ? "min-w-0 pb-32" : "min-w-0 pb-6"}>
      <header className="sticky top-[env(safe-area-inset-top)] z-30 -mx-3 mb-5 border-b border-border bg-bg/95 px-3 py-3 backdrop-blur min-[360px]:-mx-4 min-[360px]:px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/workouts")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface active:scale-95"
            aria-label="Save and exit workout"
          >
            <X size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => apiPatch(`/api/sessions/${id}`, { name })}
              aria-label="Workout name"
              className="w-full truncate bg-transparent text-lg font-bold outline-none focus:text-accent"
            />
            <div className="mt-1 flex items-center gap-2">
              <p className="shrink-0 text-[11px] text-muted tabular-nums">
                {completedCount} of {totalSets} sets
              </p>
              <div className="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
          <button
            onClick={finish}
            className="btn-primary h-10 shrink-0 px-3 py-0 text-sm"
          >
            <Flag size={15} /> Finish
          </button>
        </div>
      </header>

      {blocks.length === 0 && (
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <Dumbbell className="text-muted" size={32} />
          <p className="text-muted text-sm">
            Empty workout. Add an exercise to get started.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {blocks.map((b, exIdx) => (
          <section
            key={`${b.exerciseId}-${exIdx}`}
            className="card min-w-0 overflow-hidden p-3 sm:p-4"
          >
            <div className="flex items-start gap-3">
              <ExerciseImage
                name={b.name}
                imageUrl={b.imageUrl}
                className="h-14 w-14"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words font-semibold leading-snug">
                    {b.name}
                  </p>
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-1 text-[11px] text-muted tabular-nums">
                    {b.sets.filter((set) => set.completed).length}/{b.sets.length}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {b.maxReps > 0 && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                      {b.minReps}–{b.maxReps} reps
                    </span>
                  )}
                  {rirTarget(b.targetRirMin, b.targetRirMax) && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                      {rirTarget(b.targetRirMin, b.targetRirMax)}
                    </span>
                  )}
                  {b.isAnchor && (
                    <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] text-warn">Anchor</span>
                  )}
                  {b.avoidFailure && (
                    <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] text-danger">Never to failure</span>
                  )}
                  {b.supersetGroup && (
                    <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] text-warn">Superset</span>
                  )}
                </div>
                {b.recommendation && (
                  <div className="mt-2">
                    <p className={`text-xs font-medium ${
                      b.recommendation.action === "increase" ? "text-accent" :
                      b.recommendation.action === "reduce" ? "text-warn" : "text-muted"
                    }`}>
                      {b.recommendation.message}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                      Why: {b.recommendation.reason}
                    </p>
                  </div>
                )}
                {b.instruction && (
                  <p className="mt-2 rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
                    {b.instruction}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,0.72fr)_3rem_2.75rem] items-center gap-1.5 px-1 text-center text-[10px] uppercase tracking-wide text-muted min-[360px]:gap-2">
              <span className="text-left">Set</span>
              <span>kg</span>
              <span>reps</span>
              <span>RIR</span>
              <span className="sr-only">Complete</span>
            </div>

            <div className="mt-1 flex flex-col gap-2">
              {b.sets.map((s, si) => (
                <div
                  key={s.key}
                  className={`grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,0.72fr)_3rem_2.75rem] items-center gap-1.5 rounded-xl p-1 transition min-[360px]:gap-2 ${
                    s.completed ? "bg-accent/10 ring-1 ring-inset ring-accent/15" : ""
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${
                    s.completed ? "bg-accent/15 text-accent" : "text-muted"
                  }`}>
                    {si + 1}
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step={0.5}
                    placeholder={
                      b.lastSets[si]?.weightKg
                        ? String(b.lastSets[si].weightKg)
                        : "0"
                    }
                    value={s.weight}
                    min={0}
                    aria-label={`${b.name}, set ${si + 1}, weight in kilograms`}
                    onChange={(e) =>
                      patchSet(exIdx, s.key, { weight: e.target.value })
                    }
                    onBlur={() => commitValues(exIdx, s)}
                    className="min-w-0 w-full rounded-lg border border-border bg-surface-2 px-1 py-2.5 text-center text-base tabular-nums outline-none focus:border-accent"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder={
                      b.lastSets[si]?.reps
                        ? String(b.lastSets[si].reps)
                        : b.minReps
                          ? String(b.minReps)
                          : "0"
                    }
                    value={s.reps}
                    aria-label={`${b.name}, set ${si + 1}, repetitions`}
                    onChange={(e) =>
                      patchSet(exIdx, s.key, { reps: e.target.value })
                    }
                    onBlur={() => commitValues(exIdx, s)}
                    className="min-w-0 w-full rounded-lg border border-border bg-surface-2 px-1 py-2.5 text-center text-base tabular-nums outline-none focus:border-accent"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={10}
                    placeholder={b.targetRirMin == null ? "–" : String(b.targetRirMin)}
                    value={s.rir}
                    aria-label={`${b.name}, set ${si + 1}, reps in reserve`}
                    onChange={(e) => patchSet(exIdx, s.key, { rir: e.target.value })}
                    onBlur={() => commitValues(exIdx, s)}
                    className="min-w-0 w-full rounded-lg border border-border bg-surface-2 px-1 py-2.5 text-center text-sm tabular-nums outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => toggleComplete(exIdx, s.key)}
                    className={`flex h-11 w-11 items-center justify-center rounded-lg transition active:scale-95 ${
                      s.completed
                        ? "bg-accent text-bg"
                        : "bg-surface-2 border border-border text-muted"
                    }`}
                    aria-label="Complete set"
                  >
                    <Check size={18} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => addSet(exIdx)}
                className="btn-ghost min-w-0 flex-1 py-2 text-sm"
              >
                <Plus size={16} /> Add set
              </button>
              {b.sets.length > 0 && (
                <button
                  onClick={() => removeSet(exIdx, b.sets[b.sets.length - 1].key)}
                  className="btn-ghost h-10 w-11 shrink-0 px-0 py-0 text-sm"
                  aria-label="Remove last set"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      <button
        onClick={() => setPicking(true)}
        className="btn-ghost mt-4 w-full"
      >
        <Plus size={18} /> Add exercise
      </button>

      <button
        onClick={discard}
        className="mt-5 w-full py-2 text-center text-sm text-danger"
      >
        Discard workout
      </button>

      {picking && (
        <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />
      )}

      {rest && (
        <RestTimer
          startedAt={rest.startedAt}
          targetSeconds={rest.target}
          label={rest.label}
          onEnd={() => setRest(null)}
        />
      )}
    </div>
  );
}
