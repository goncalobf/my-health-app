"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Plus,
  Minus,
  Trash2,
  Flag,
  X,
  Dumbbell,
  ChevronDown,
  LayoutList,
  TrendingDown,
} from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import ExercisePicker from "@/components/ExercisePicker";
import ExerciseImage from "@/components/ExerciseImage";
import RestTimer from "@/components/RestTimer";
import HypeScreen from "@/components/HypeScreen";
import { pickLine } from "@/lib/motivation";
import { normalizeDecimalInput, parseDecimalInput } from "@/lib/decimal-input";
import { prefillSet, suggestDropWeight } from "@/lib/set-prefill";
import {
  firstIncompletePosition,
  groupLoggedRows,
  nextIncompletePosition,
  nextSetNumber,
} from "@/lib/workout-flow";

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
  isDropSet: boolean;
  completedAt: string | null;
}
interface Recommendation {
  action: "start" | "increase" | "repeat" | "reduce";
  weightKg: number | null;
  message: string;
  reason: string;
}
interface SessionData {
  session: { id: number; name: string; startedAt: string; finishedAt: string | null };
  plan: PlanItem[];
  loggedSets: LoggedSet[];
  lastSets: Record<number, { weightKg: number; reps: number; rir: number | null }[]>;
  recommendations: Record<number, Recommendation>;
}

/** One persisted row: the working effort, or a drop taken straight after it. */
interface SetEntry {
  key: string;
  dbId?: number;
  weight: string;
  reps: string;
  rir: string;
  isDrop: boolean;
}
/** A set as the lifter thinks of it: one effort plus any drops hanging off it. */
interface LocalSet {
  key: string;
  /** Stable across removals: every entry of this set persists under it. */
  setNumber: number;
  entries: SetEntry[];
  completed: boolean;
}
interface Block {
  exerciseId: number;
  name: string;
  imageUrl: string | null;
  targetReps: number;
  minReps: number;
  maxReps: number;
  weightIncrementKg: number;
  restSeconds: number;
  targetRirMin: number | null;
  targetRirMax: number | null;
  avoidFailure: boolean;
  instruction: string | null;
  supersetGroup: string | null;
  isAnchor: boolean;
  deloadMode: boolean;
  lastSets: { weightKg: number; reps: number; rir: number | null }[];
  recommendation?: Recommendation;
  sets: LocalSet[];
}

interface Cursor {
  exIdx: number;
  setKey: string;
}

let keyc = 0;
const nk = () => `s${keyc++}`;

function rirTarget(min: number | null, max: number | null) {
  if (min == null) return null;
  return min === max || max == null ? `RIR ${min}` : `RIR ${min}–${max}`;
}

function numberText(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
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
  const [overview, setOverview] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [hype, setHype] = useState(false);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [rest, setRest] = useState<{
    seq: number;
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
    ): Block => {
      const logged = data.loggedSets.filter((s) => s.exerciseId === exerciseId);
      const last = data.lastSets[exerciseId] ?? [];
      const recommendation = data.recommendations[exerciseId];

      let sets: LocalSet[];
      if (logged.length) {
        sets = groupLoggedRows(logged).map((group) => ({
          key: nk(),
          setNumber: group.setNumber,
          completed: group.completed,
          entries: group.rows.map((row) => ({
            key: nk(),
            dbId: row.id,
            weight: numberText(row.weightKg),
            reps: String(row.reps),
            rir: row.rir == null ? "" : String(row.rir),
            isDrop: row.isDropSet,
          })),
        }));
      } else {
        const count = Math.max(1, opts.targetSets);
        sets = Array.from({ length: count }, (_, i) => {
          const filled = prefillSet(
            {
              minReps: opts.minReps,
              maxReps: opts.maxReps,
              recommendedWeightKg: recommendation?.weightKg ?? null,
              recommendationAction: recommendation?.action ?? null,
            },
            last[i] ?? last[last.length - 1] ?? null
          );
          return {
            key: nk(),
            setNumber: i + 1,
            completed: false,
            entries: [
              {
                key: nk(),
                weight: filled.weightKg ? numberText(filled.weightKg) : "",
                reps: filled.reps ? String(filled.reps) : "",
                rir: opts.targetRirMin == null ? "" : String(opts.targetRirMin),
                isDrop: false,
              },
            ],
          };
        });
      }
      return {
        exerciseId,
        name: opts.name,
        imageUrl: opts.imageUrl,
        targetReps: opts.targetReps,
        minReps: opts.minReps,
        maxReps: opts.maxReps,
        weightIncrementKg: opts.weightIncrementKg,
        restSeconds: opts.restSeconds,
        targetRirMin: opts.targetRirMin,
        targetRirMax: opts.targetRirMax,
        avoidFailure: opts.avoidFailure,
        instruction: opts.instruction,
        supersetGroup: opts.supersetGroup,
        isAnchor: opts.isAnchor,
        deloadMode: opts.deloadMode,
        lastSets: last,
        recommendation,
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
          weightIncrementKg: p.weightIncrementKg,
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
          weightIncrementKg: 2.5,
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
    setCursor(firstIncompletePosition(built));
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Only a freshly started workout arrives with ?hype=1.
    setHype(new URLSearchParams(window.location.search).get("hype") === "1");
  }, []);

  function patchEntry(
    exIdx: number,
    setKey: string,
    entryKey: string,
    patch: Partial<SetEntry>
  ) {
    setBlocks((bs) =>
      bs.map((b, i) =>
        i !== exIdx
          ? b
          : {
              ...b,
              sets: b.sets.map((s) =>
                s.key !== setKey
                  ? s
                  : {
                      ...s,
                      entries: s.entries.map((e) =>
                        e.key === entryKey ? { ...e, ...patch } : e
                      ),
                    }
              ),
            }
      )
    );
  }

  async function persistEntry(
    block: Block,
    set: LocalSet,
    entry: SetEntry,
    completed: boolean
  ) {
    const payload = {
      weightKg: parseDecimalInput(entry.weight),
      reps: Number(entry.reps) || 0,
      rir: entry.rir,
      completed,
    };
    if (entry.dbId) {
      await apiPatch(`/api/sessions/${id}/sets/${entry.dbId}`, payload);
      return entry.dbId;
    }
    const created = await apiPost<{ id: number }>(`/api/sessions/${id}/sets`, {
      ...payload,
      exerciseId: block.exerciseId,
      setNumber: set.setNumber,
      isDropSet: entry.isDrop,
    });
    return created.id;
  }

  async function logSet() {
    if (!active) return;
    const { block, exIdx, set, entry } = active;
    const dbId = await persistEntry(block, set, entry, true);
    patchEntry(exIdx, set.key, entry.key, { dbId });
    setBlocks((bs) =>
      bs.map((b, i) =>
        i !== exIdx
          ? b
          : {
              ...b,
              sets: b.sets.map((s) =>
                s.key === set.key ? { ...s, completed: true } : s
              ),
            }
      )
    );

    const upcoming = nextIncompletePosition(blocks, exIdx, set.key);
    setRest((prev) => ({
      seq: (prev?.seq ?? 0) + 1,
      target: block.restSeconds,
      label: upcoming ? describe(blocks, upcoming) : "Last set done",
    }));
    setCursor(upcoming);
    setShowWhy(false);
  }

  /** Ends the current effort and opens a lighter one under the same set. */
  async function addDrop() {
    if (!active) return;
    const { block, exIdx, set, entry } = active;
    const dbId = await persistEntry(block, set, entry, true);
    const dropWeight = suggestDropWeight(
      parseDecimalInput(entry.weight),
      block.weightIncrementKg
    );
    setBlocks((bs) =>
      bs.map((b, i) =>
        i !== exIdx
          ? b
          : {
              ...b,
              sets: b.sets.map((s) =>
                s.key !== set.key
                  ? s
                  : {
                      ...s,
                      entries: [
                        ...s.entries.map((e) =>
                          e.key === entry.key ? { ...e, dbId } : e
                        ),
                        {
                          key: nk(),
                          weight: dropWeight ? numberText(dropWeight) : "",
                          reps: entry.reps,
                          rir: "",
                          isDrop: true,
                        },
                      ],
                    }
              ),
            }
      )
    );
  }

  async function discardDrop() {
    if (!active || active.set.entries.length < 2) return;
    const { exIdx, set, entry } = active;
    if (entry.dbId) await apiDelete(`/api/sessions/${id}/sets/${entry.dbId}`);
    setBlocks((bs) =>
      bs.map((b, i) =>
        i !== exIdx
          ? b
          : {
              ...b,
              sets: b.sets.map((s) =>
                s.key !== set.key
                  ? s
                  : { ...s, entries: s.entries.filter((e) => e.key !== entry.key) }
              ),
            }
      )
    );
  }

  function addSet(exIdx: number) {
    const block = blocks[exIdx];
    const previous = block.sets[block.sets.length - 1]?.entries[0];
    const created: LocalSet = {
      key: nk(),
      setNumber: nextSetNumber(block.sets),
      completed: false,
      entries: [
        {
          key: nk(),
          weight: previous?.weight ?? "",
          reps: previous?.reps ?? (block.minReps ? String(block.minReps) : ""),
          rir: block.targetRirMin == null ? "" : String(block.targetRirMin),
          isDrop: false,
        },
      ],
    };
    setBlocks((bs) =>
      bs.map((b, i) => (i === exIdx ? { ...b, sets: [...b.sets, created] } : b))
    );
    setCursor({ exIdx, setKey: created.key });
  }

  async function removeSet(exIdx: number, setKey: string) {
    const set = blocks[exIdx].sets.find((s) => s.key === setKey);
    if (!set) return;
    for (const entry of set.entries) {
      if (entry.dbId) await apiDelete(`/api/sessions/${id}/sets/${entry.dbId}`);
    }
    const remaining = blocks[exIdx].sets.filter((s) => s.key !== setKey);
    setBlocks((bs) =>
      bs.map((b, i) => (i === exIdx ? { ...b, sets: remaining } : b))
    );
    if (cursor?.setKey === setKey) {
      setCursor(
        remaining.length
          ? { exIdx, setKey: remaining[remaining.length - 1].key }
          : firstIncompletePosition(blocks)
      );
    }
  }

  async function addExercise(exerciseId: number) {
    setPicking(false);
    const exercises = await apiGet<
      { id: number; name: string; imageUrl: string | null }[]
    >("/api/exercises");
    const ex = exercises.find((e) => e.id === exerciseId);
    const created: Block = {
      exerciseId,
      name: ex?.name ?? "Exercise",
      imageUrl: ex?.imageUrl ?? null,
      targetReps: 0,
      minReps: 0,
      maxReps: 0,
      weightIncrementKg: 2.5,
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
      sets: [
        {
          key: nk(),
          setNumber: 1,
          completed: false,
          entries: [{ key: nk(), weight: "", reps: "", rir: "", isDrop: false }],
        },
      ],
    };
    setBlocks((bs) => [...bs, created]);
    setCursor({ exIdx: blocks.length, setKey: created.sets[0].key });
    setOverview(false);
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

  const totalSets = blocks.reduce((total, b) => total + b.sets.length, 0);
  const completedCount = blocks.reduce(
    (total, b) => total + b.sets.filter((s) => s.completed).length,
    0
  );
  const progress = totalSets ? Math.round((completedCount / totalSets) * 100) : 0;

  const active = resolve(blocks, cursor);

  if (loading) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-muted">Loading your workout…</p>
      </div>
    );
  }

  if (hype) {
    return (
      <HypeScreen
        seed={`session-${id}`}
        workoutName={name}
        totalSets={totalSets}
        exerciseCount={blocks.length}
        onStart={() => {
          setHype(false);
          window.history.replaceState(null, "", `/workouts/session/${id}`);
        }}
      />
    );
  }

  return (
    <div className={rest ? "min-w-0 pb-32" : "min-w-0 pb-8"}>
      <header className="sticky top-[env(safe-area-inset-top)] z-30 -mx-3 mb-5 border-b border-border bg-bg/95 px-3 py-3 backdrop-blur min-[360px]:-mx-4 min-[360px]:px-4">
        <p className="mb-2 pl-12 text-[9px] font-bold uppercase tracking-[0.22em] text-accent">Fitlog / live protocol</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/workouts")}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-surface text-muted transition active:scale-95 [border-radius:2px_10px_2px_2px]"
            aria-label="Save and exit workout"
          >
            <X size={22} />
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => apiPatch(`/api/sessions/${id}`, { name })}
            aria-label="Workout name"
            className="min-w-0 flex-1 truncate bg-transparent font-display text-2xl tracking-[0.04em] outline-none focus:text-accent"
          />
          <button
            onClick={finish}
            className="btn-primary h-10 shrink-0 px-3 py-0 text-sm"
          >
            <Flag size={15} /> Finish
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <p className="shrink-0 font-display text-sm tracking-[0.08em] text-muted tabular-nums">
            {completedCount} of {totalSets} sets
          </p>
          <div className="h-1 min-w-8 flex-1 overflow-hidden bg-surface-2">
            <div
              className="h-full bg-accent transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {blocks.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <Dumbbell className="text-muted" size={32} />
          <p className="text-sm text-muted">
            Empty workout. Add an exercise to get started.
          </p>
          <button onClick={() => setPicking(true)} className="btn-primary w-full">
            <Plus size={18} /> Add exercise
          </button>
        </div>
      ) : !active ? (
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <div className="icon-frame h-14 w-14"><Check size={28} strokeWidth={3} /></div>
          <p className="font-display text-2xl tracking-[0.04em]">Every set is logged</p>
          <p className="text-sm text-muted">
            {completedCount} sets done. Finish up to see your summary and next targets.
          </p>
          <button onClick={finish} className="btn-primary w-full">
            <Flag size={18} /> Finish workout
          </button>
        </div>
      ) : (
        <ActiveSet
          key={active.entry.key}
          block={active.block}
          set={active.set}
          setIdx={active.setIdx}
          entry={active.entry}
          showWhy={showWhy}
          onToggleWhy={() => setShowWhy((v) => !v)}
          onChange={(patch) =>
            patchEntry(active.exIdx, active.set.key, active.entry.key, patch)
          }
          onCommit={() => {
            if (active.entry.dbId) {
              persistEntry(
                active.block,
                active.set,
                active.entry,
                active.set.completed
              );
            }
          }}
          onLog={() => logSet()}
          onDrop={() => addDrop()}
          onDiscardDrop={() => discardDrop()}
          onJump={(setKey) => {
            setCursor({ exIdx: active.exIdx, setKey });
            setShowWhy(false);
          }}
          onAddSet={() => addSet(active.exIdx)}
          onRemoveSet={() => removeSet(active.exIdx, active.set.key)}
        />
      )}

      {blocks.length > 0 && (
        <button
          onClick={() => setOverview(true)}
          className="btn-ghost mt-4 w-full"
        >
          <LayoutList size={18} /> Workout overview
        </button>
      )}

      {overview && (
        <Overview
          blocks={blocks}
          activeExIdx={active?.exIdx ?? -1}
          onJump={(exIdx, setKey) => {
            setCursor({ exIdx, setKey });
            setShowWhy(false);
            setOverview(false);
          }}
          onAddExercise={() => setPicking(true)}
          onDiscard={discard}
          onClose={() => setOverview(false)}
        />
      )}

      {picking && (
        <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />
      )}

      {rest && (
        <RestTimer
          key={rest.seq}
          targetSeconds={rest.target}
          label={rest.label}
          note={pickLine("workout", `${id}-${rest.seq}`)}
          onEnd={() => setRest(null)}
        />
      )}
    </div>
  );
}

function resolve(blocks: Block[], cursor: Cursor | null) {
  if (!cursor) return null;
  const block = blocks[cursor.exIdx];
  if (!block) return null;
  const setIdx = block.sets.findIndex((s) => s.key === cursor.setKey);
  if (setIdx === -1) return null;
  const set = block.sets[setIdx];
  const entry = set.entries[set.entries.length - 1];
  if (!entry) return null;
  return { block, exIdx: cursor.exIdx, set, setIdx, entry };
}

function describe(blocks: Block[], cursor: Cursor) {
  const block = blocks[cursor.exIdx];
  const setIdx = block.sets.findIndex((s) => s.key === cursor.setKey);
  return `${block.name} · set ${setIdx + 1}`;
}

function ActiveSet({
  block,
  set,
  setIdx,
  entry,
  showWhy,
  onToggleWhy,
  onChange,
  onCommit,
  onLog,
  onDrop,
  onDiscardDrop,
  onJump,
  onAddSet,
  onRemoveSet,
}: {
  block: Block;
  set: LocalSet;
  setIdx: number;
  entry: SetEntry;
  showWhy: boolean;
  onToggleWhy: () => void;
  onChange: (patch: Partial<SetEntry>) => void;
  onCommit: () => void;
  onLog: () => void;
  onDrop: () => void;
  onDiscardDrop: () => void;
  onJump: (setKey: string) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
}) {
  const previousEntries = set.entries.slice(0, -1);
  const dropIndex = entry.isDrop ? previousEntries.length : 0;
  const reference = block.lastSets[setIdx] ?? block.lastSets[block.lastSets.length - 1];
  const canLog = (Number(entry.reps) || 0) > 0;

  return (
    <div className="min-w-0">
      <div className="card min-w-0 overflow-hidden p-4 min-[360px]:p-5">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent">Active movement</p>
          <span className="font-display text-lg text-muted/35">{String(setIdx + 1).padStart(2, "0")}</span>
        </div>
        <div className="flex items-start gap-3">
          <ExerciseImage
            name={block.name}
            imageUrl={block.imageUrl}
            className="h-14 w-14"
          />
          <div className="min-w-0 flex-1">
            <p className="min-w-0 break-words font-display text-2xl leading-none tracking-[0.035em]">
              {block.name}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {block.maxReps > 0 && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                  {block.minReps}–{block.maxReps} reps
                </span>
              )}
              {rirTarget(block.targetRirMin, block.targetRirMax) && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                  {rirTarget(block.targetRirMin, block.targetRirMax)}
                </span>
              )}
              {block.isAnchor && (
                <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] text-warn">
                  Anchor
                </span>
              )}
              {block.avoidFailure && (
                <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] text-danger">
                  Never to failure
                </span>
              )}
              {block.supersetGroup && (
                <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] text-warn">
                  Superset
                </span>
              )}
            </div>
          </div>
        </div>

        {block.recommendation && (
          <div className="mt-3">
            <button
              onClick={onToggleWhy}
              className="flex w-full items-start gap-1.5 text-left"
            >
              <span
                className={`min-w-0 flex-1 text-xs font-medium ${
                  block.recommendation.action === "increase"
                    ? "text-accent"
                    : block.recommendation.action === "reduce"
                      ? "text-warn"
                      : "text-muted"
                }`}
              >
                {block.recommendation.message}
              </span>
              <ChevronDown
                size={14}
                className={`mt-0.5 shrink-0 text-muted transition ${showWhy ? "rotate-180" : ""}`}
              />
            </button>
            {showWhy && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                {block.recommendation.reason}
              </p>
            )}
          </div>
        )}

        {block.instruction && (
          <p className="mt-2 rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
            {block.instruction}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-display text-2xl tracking-[0.04em]">
            {entry.isDrop ? (
              <span className="text-warn">Drop {dropIndex}</span>
            ) : (
              `Set ${setIdx + 1} of ${block.sets.length}`
            )}
          </p>
          {reference && (
            <p className="text-[11px] text-muted tabular-nums">
              Last time: {numberText(reference.weightKg)} × {reference.reps}
            </p>
          )}
        </div>

        {previousEntries.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {previousEntries.map((done, i) => (
              <span key={done.key} className="flex items-center gap-1">
                {i > 0 && <span className="text-[10px] text-muted">→</span>}
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted tabular-nums">
                  {done.weight || 0} × {done.reps || 0}
                </span>
              </span>
            ))}
            <span className="text-[10px] text-muted">→</span>
            <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[11px] font-medium text-warn">
              now
            </span>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          <Stepper
            label="Weight"
            unit="kg"
            value={entry.weight}
            step={block.weightIncrementKg || 2.5}
            decimal
            onChange={(weight) => onChange({ weight })}
            onCommit={onCommit}
          />
          <Stepper
            label="Reps"
            unit="reps"
            value={entry.reps}
            step={1}
            onChange={(reps) => onChange({ reps })}
            onCommit={onCommit}
          />
        </div>

        <div className="mt-3">
          <p className="label">Reps in reserve</p>
          <div className="mt-1.5 flex gap-1.5">
            {["0", "1", "2", "3", "4", "5"].map((value) => {
              const selected = entry.rir === value;
              return (
                <button
                  key={value}
                  onClick={() => {
                    onChange({ rir: selected ? "" : value });
                    onCommit();
                  }}
                  className={`min-w-0 flex-1 py-2.5 font-display text-base tabular-nums transition active:scale-95 [border-radius:2px_7px_2px_2px] ${
                    selected
                      ? "bg-accent text-bg"
                      : "border border-border bg-surface-2 text-muted"
                  }`}
                  aria-pressed={selected}
                  aria-label={`Reps in reserve ${value}`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={onLog}
          disabled={!canLog}
          className="btn-primary mt-4 w-full py-3.5 text-base"
        >
          <Check size={19} strokeWidth={3} />
          {canLog ? "Log set" : "Add reps to log"}
        </button>

        <div className="mt-2 flex gap-2">
          <button
            onClick={onDrop}
            disabled={!canLog}
            className="btn-ghost min-w-0 flex-1 py-2 text-sm text-warn"
          >
            <TrendingDown size={16} /> Drop set
          </button>
          {entry.isDrop && (
            <button
              onClick={onDiscardDrop}
              className="btn-ghost h-10 w-11 shrink-0 px-0 py-0"
              aria-label="Discard this drop"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          Drop keeps you on this set: it saves what you just did, strips the weight
          and skips the rest so you can carry on lighter.
        </p>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {block.sets.map((s, i) => {
            const current = s.key === set.key;
            const drops = s.entries.length - 1;
            return (
              <button
                key={s.key}
                onClick={() => onJump(s.key)}
                aria-label={`Go to set ${i + 1}`}
                aria-current={current}
                className={`relative flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium tabular-nums transition active:scale-95 ${
                  current
                    ? "bg-accent text-bg"
                    : s.completed
                      ? "bg-accent/15 text-accent"
                      : "border border-border bg-surface-2 text-muted"
                }`}
              >
                {s.completed && !current ? <Check size={15} strokeWidth={3} /> : i + 1}
                {drops > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warn text-[9px] font-bold text-bg">
                    {drops}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={onAddSet}
          className="btn-ghost h-9 w-10 shrink-0 px-0 py-0"
          aria-label="Add a set to this exercise"
        >
          <Plus size={16} />
        </button>
        {block.sets.length > 1 && (
          <button
            onClick={onRemoveSet}
            className="btn-ghost h-9 w-10 shrink-0 px-0 py-0"
            aria-label="Remove this set"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function Stepper({
  label,
  unit,
  value,
  step,
  decimal = false,
  onChange,
  onCommit,
}: {
  label: string;
  unit: string;
  value: string;
  step: number;
  decimal?: boolean;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  const current = decimal ? parseDecimalInput(value) : Number(value) || 0;

  function nudge(delta: number) {
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    onChange(decimal ? numberText(next) : String(Math.round(next)));
    onCommit();
  }

  return (
    <div className="border border-border bg-surface-2 p-2.5 [border-radius:2px_12px_2px_2px]">
      <p className="mb-1 text-center font-display text-sm uppercase tracking-[0.12em] text-muted">{label}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => nudge(-step)}
          className="flex h-12 w-12 shrink-0 items-center justify-center border border-border bg-surface text-text transition active:scale-95 [border-radius:2px_9px_2px_2px]"
          aria-label={`Decrease ${label}`}
        >
          <Minus size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <input
            inputMode="decimal"
            value={value}
            placeholder="0"
            aria-label={label}
            onChange={(e) =>
              onChange(
                decimal
                  ? normalizeDecimalInput(e.target.value)
                  : e.target.value.replace(/[^\d]/g, "")
              )
            }
            onBlur={onCommit}
            className="w-full bg-transparent text-center font-display text-4xl tabular-nums outline-none placeholder:text-muted"
          />
          <p className="text-center text-[11px] text-muted">{unit}</p>
        </div>
        <button
          onClick={() => nudge(step)}
          className="flex h-12 w-12 shrink-0 items-center justify-center border border-border bg-surface text-text transition active:scale-95 [border-radius:2px_9px_2px_2px]"
          aria-label={`Increase ${label}`}
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}

function Overview({
  blocks,
  activeExIdx,
  onJump,
  onAddExercise,
  onDiscard,
  onClose,
}: {
  blocks: Block[];
  activeExIdx: number;
  onJump: (exIdx: number, setKey: string) => void;
  onAddExercise: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg/95 backdrop-blur">
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-3 min-[360px]:px-4">
        <div className="flex shrink-0 items-center gap-2 py-3 safe-top">
          <div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent">Fitlog / session map</p><h2 className="font-display text-3xl tracking-[0.04em]">Workout overview</h2></div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-surface text-muted transition active:scale-95 [border-radius:2px_9px_2px_2px]"
            aria-label="Close overview"
          >
            <X size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pb-4">
          <div className="flex flex-col gap-2">
            {blocks.map((block, exIdx) => {
              const done = block.sets.filter((s) => s.completed).length;
              const target =
                block.sets.find((s) => !s.completed) ?? block.sets[block.sets.length - 1];
              return (
                <button
                  key={`${block.exerciseId}-${exIdx}`}
                  onClick={() => target && onJump(exIdx, target.key)}
                  className={`card flex items-center gap-3 p-3 text-left transition active:scale-[0.99] ${
                    exIdx === activeExIdx ? "border-accent/40" : ""
                  }`}
                >
                  <ExerciseImage
                    name={block.name}
                    imageUrl={block.imageUrl}
                    className="h-11 w-11"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{block.name}</p>
                    <p className="text-[11px] text-muted tabular-nums">
                      {done} of {block.sets.length} sets
                    </p>
                  </div>
                  {done === block.sets.length ? (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      <Check size={15} strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] text-muted tabular-nums">
                      {block.sets.length - done} left
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button onClick={onAddExercise} className="btn-ghost mt-4 w-full">
            <Plus size={18} /> Add exercise
          </button>
          <button
            onClick={onDiscard}
            className="mt-2 w-full py-2 text-center text-sm text-danger"
          >
            Discard workout
          </button>
        </div>
      </div>
    </div>
  );
}
