"use client";

import { use, useEffect, useState } from "react";
import { ChevronDown, Copy, Dumbbell, History, Trophy } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiGet, apiPost } from "@/lib/api";
import { formatDate } from "@/lib/utils";

interface RoutineSummary { id: number; name: string; notes: string | null; exerciseCount: number; }
interface RoutineExerciseDetail {
  id: number; name: string; muscleGroup: string | null;
  targetSets: number; minReps: number; maxReps: number;
  targetRirMin: number | null; targetRirMax: number | null;
}
interface RoutineDetail extends RoutineSummary { exercises: RoutineExerciseDetail[]; }
interface HistorySession { id: number; name: string; startedAt: string; finishedAt: string | null; }
interface PersonalRecord { exerciseId: number; name: string; bestWeightKg: number; bestReps: number; est1RM: number; }
interface HistoryResponse { recentSessions: HistorySession[]; personalRecords: PersonalRecord[]; }
interface FriendsResponse { friends: { id: number; username: string | null; name: string | null; friendshipId: number }[]; }

function repRange(item: RoutineExerciseDetail) {
  return item.minReps === item.maxReps ? `${item.minReps}` : `${item.minReps}–${item.maxReps}`;
}
function rirRange(item: RoutineExerciseDetail) {
  if (item.targetRirMin == null) return null;
  return item.targetRirMin === item.targetRirMax ? `RIR ${item.targetRirMin}` : `RIR ${item.targetRirMin}–${item.targetRirMax}`;
}

export default function FriendDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [friendName, setFriendName] = useState<string | null>(null);
  const [routines, setRoutines] = useState<RoutineSummary[] | null>(null);
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [expanded, setExpanded] = useState<Record<number, RoutineDetail | "loading">>({});
  const [cloning, setCloning] = useState<number | null>(null);
  const [cloneMessage, setCloneMessage] = useState("");

  useEffect(() => {
    apiGet<FriendsResponse>("/api/friends").then((data) => {
      const match = data.friends.find((f) => f.friendshipId === Number(id));
      setFriendName(match?.name || match?.username || "Friend");
    });
    apiGet<RoutineSummary[]>(`/api/friends/${id}/routines`).then(setRoutines);
    apiGet<HistoryResponse>(`/api/friends/${id}/history`).then(setHistory);
  }, [id]);

  async function toggleRoutine(routineId: number) {
    if (expanded[routineId]) {
      setExpanded((prev) => { const next = { ...prev }; delete next[routineId]; return next; });
      return;
    }
    setExpanded((prev) => ({ ...prev, [routineId]: "loading" }));
    const detail = await apiGet<RoutineDetail>(`/api/friends/${id}/routines/${routineId}`);
    setExpanded((prev) => ({ ...prev, [routineId]: detail }));
  }

  async function cloneRoutine(routineId: number) {
    setCloning(routineId);
    setCloneMessage("");
    try {
      await apiPost(`/api/friends/${id}/routines/${routineId}/clone`, {});
      setCloneMessage("Added to your routines.");
    } catch (err) {
      setCloneMessage(err instanceof Error ? err.message : "Could not clone this routine.");
    } finally {
      setCloning(null);
    }
  }

  return (
    <div>
      <PageHeader title={friendName ?? "Friend"} back="/friends" />

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted"><Dumbbell size={15} /> Routines</h2>
        {routines == null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : routines.length === 0 ? (
          <div className="card p-4 text-center text-sm text-muted">No routines yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {routines.map((routine) => {
              const detail = expanded[routine.id];
              return (
                <div key={routine.id} className="card overflow-hidden p-0">
                  <button onClick={() => toggleRoutine(routine.id)} className="flex w-full items-center gap-3 p-4 text-left active:scale-[0.99] transition">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{routine.name}</p>
                      <p className="text-xs text-muted">{routine.exerciseCount} exercise{routine.exerciseCount === 1 ? "" : "s"}</p>
                    </div>
                    <ChevronDown size={18} className={`shrink-0 text-muted transition ${detail ? "rotate-180" : ""}`} />
                  </button>
                  {detail === "loading" && <p className="px-4 pb-4 text-sm text-muted">Loading…</p>}
                  {detail && detail !== "loading" && (
                    <div className="border-t border-border p-4">
                      <div className="flex flex-col gap-2">
                        {detail.exercises.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate">{item.name}</span>
                            <span className="shrink-0 text-xs text-muted tabular-nums">{item.targetSets}×{repRange(item)}{rirRange(item) ? ` · ${rirRange(item)}` : ""}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => cloneRoutine(routine.id)}
                        disabled={cloning === routine.id}
                        className="btn-ghost mt-3 w-full"
                      >
                        <Copy size={16} /> {cloning === routine.id ? "Adding…" : "Clone to my routines"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {cloneMessage && <p className="mt-2 text-xs text-accent">{cloneMessage}</p>}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted"><Trophy size={15} /> Personal records</h2>
        {!history ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : history.personalRecords.length === 0 ? (
          <div className="card p-4 text-center text-sm text-muted">No records yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.personalRecords.slice(0, 10).map((pr) => (
              <div key={pr.exerciseId} className="card flex items-center justify-between p-3">
                <span className="min-w-0 truncate text-sm font-medium">{pr.name}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{pr.bestWeightKg} kg × {pr.bestReps}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-muted"><History size={15} /> Recent workouts</h2>
        {!history ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : history.recentSessions.length === 0 ? (
          <div className="card p-4 text-center text-sm text-muted">Nothing logged yet.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.recentSessions.map((session) => (
              <div key={session.id} className="card flex items-center justify-between p-3">
                <span className="min-w-0 truncate text-sm font-medium">{session.name}</span>
                <span className="shrink-0 text-xs text-muted">{formatDate(new Date(session.startedAt).toISOString().slice(0, 10))}{!session.finishedAt && " · in progress"}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
