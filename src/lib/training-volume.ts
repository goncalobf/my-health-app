import type { MuscleProfile } from "./training-prescription";
interface Exposure {
  sets: number;
  muscleGroup: string | null;
  muscleProfile: MuscleProfile | null;
}
export function muscleVolume(planned: Exposure[], completed: Exposure[]) {
  const totals = new Map<
    string,
    {
      muscle: string;
      plannedDirect: number;
      plannedIndirect: number;
      completedDirect: number;
      completedIndirect: number;
    }
  >();
  for (const [kind, rows] of [
    ["planned", planned],
    ["completed", completed],
  ] as const)
    for (const row of rows) {
      const direct = row.muscleProfile?.direct ?? [
        row.muscleGroup || "Unclassified",
      ];
      const indirect = row.muscleProfile?.indirect ?? [];
      for (const [type, names] of [
        ["Direct", direct],
        ["Indirect", indirect],
      ] as const)
        for (const muscle of new Set(names)) {
          const entry = totals.get(muscle) ?? {
            muscle,
            plannedDirect: 0,
            plannedIndirect: 0,
            completedDirect: 0,
            completedIndirect: 0,
          };
          entry[`${kind}${type}`] += row.sets;
          totals.set(muscle, entry);
        }
    }
  return [...totals.values()]
    .sort((a, b) => a.muscle.localeCompare(b.muscle))
    .map((v) => ({
      ...v,
      plannedEstimate: v.plannedDirect + v.plannedIndirect * 0.5,
      completedEstimate: v.completedDirect + v.completedIndirect * 0.5,
    }));
}
export function nextRoutineInSequence<T extends { id: number }>(
  routines: T[],
  latestRoutineId: number | null,
): T | null {
  if (!routines.length) return null;
  const previous = routines.findIndex((r) => r.id === latestRoutineId);
  return routines[(previous + 1) % routines.length];
}
