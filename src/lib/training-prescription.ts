/** Immutable workout context. Machine settings and A/B prescriptions define separate tracks. */
export interface EquipmentProfile {
  machine: string;
  setup: string;
  loading: "total" | "per_side" | "per_hand" | "assistance" | "bodyweight";
  availableLoads: number[];
}
export interface MuscleProfile {
  direct: string[];
  indirect: string[];
}
export interface Prescription {
  slotId: number;
  exerciseId: number;
  name: string;
  muscleGroup: string | null;
  imageUrl: string | null;
  position: number;
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
  equipmentProfile: EquipmentProfile | null;
  muscleProfile: MuscleProfile | null;
}
export interface WorkoutSnapshot {
  version: 1;
  isDeload: boolean;
  plan: Prescription[];
}
export interface SkippedSet {
  exerciseId: number;
  setNumber: number;
}
export const performanceContexts = [
  "normal",
  "short_rest",
  "interrupted",
  "changed_setup",
  "technique_limited",
] as const;
export type PerformanceContext = (typeof performanceContexts)[number];
export const contextLabels: Record<PerformanceContext, string> = {
  normal: "Normal session",
  short_rest: "Shorter rest than planned",
  interrupted: "Interrupted workout",
  changed_setup: "Different machine or setup",
  technique_limited: "Technique limited",
};
export function comparisonKey(p: Prescription): string {
  return JSON.stringify([
    p.slotId,
    p.exerciseId,
    p.targetSets,
    p.minReps,
    p.maxReps,
    p.targetRirMin,
    p.targetRirMax,
    p.avoidFailure,
    p.restSeconds,
    p.supersetGroup,
    p.position,
    p.instruction,
    p.equipmentProfile?.machine.trim().toLowerCase() ?? "",
    p.equipmentProfile?.setup.trim().toLowerCase() ?? "",
    p.equipmentProfile?.loading ?? "total",
  ]);
}
export function comparablePrescription(
  current: Prescription,
  snapshot: WorkoutSnapshot | null,
  context: string | null,
) {
  if (!snapshot || snapshot.isDeload || context !== "normal") return false;
  return snapshot.plan.some((p) => comparisonKey(p) === comparisonKey(current));
}
export function effectivePlan(
  snapshot: WorkoutSnapshot,
): (Prescription & { deloadMode: boolean })[] {
  return snapshot.plan.map((p) =>
    snapshot.isDeload
      ? {
          ...p,
          targetSets: Math.max(1, Math.ceil(p.targetSets / 2)),
          targetRirMin: 4,
          targetRirMax: 6,
          instruction:
            `Deload: fewer sets, comfortable load and at least 4 RIR. ${p.instruction ?? ""}`.trim(),
          deloadMode: true,
        }
      : { ...p, deloadMode: false },
  );
}
