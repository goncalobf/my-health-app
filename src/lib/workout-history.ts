import {
  comparablePrescription,
  type Prescription,
  type WorkoutSnapshot,
} from "./training-prescription";
import type { ProgressionSet } from "./progressive-overload";
export interface HistoricalSet extends ProgressionSet {
  sessionId: number;
  exerciseId: number;
  startedAt: Date;
  prescriptionSnapshot: WorkoutSnapshot | null;
  performanceContext: string;
}
export function comparableHistory(
  target: Prescription,
  rows: HistoricalSet[],
  limit = 3,
) {
  const groups = new Map<
    number,
    { sessionId: number; startedAt: Date; sets: ProgressionSet[] }
  >();
  for (const row of rows) {
    if (
      row.exerciseId !== target.exerciseId ||
      !comparablePrescription(
        target,
        row.prescriptionSnapshot,
        row.performanceContext,
      )
    )
      continue;
    const group = groups.get(row.sessionId) ?? {
      sessionId: row.sessionId,
      startedAt: row.startedAt,
      sets: [],
    };
    group.sets.push({
      weightKg: row.weightKg,
      reps: row.reps,
      rir: row.rir,
      setNumber: row.setNumber,
    });
    groups.set(row.sessionId, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, limit)
    .map((g) => ({
      ...g,
      sets: g.sets.sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0)),
    }));
}
