import { sameLoad } from "./progressive-overload";
interface Submission {
  exerciseId: number;
  setNumber: number;
  weightKg: number;
  reps: number;
  rir: number | null;
  isWarmup: boolean;
  isDropSet: boolean;
}
/** A retry may acknowledge a saved observation, never silently replace it. */
export function sameSetSubmission(
  saved: Submission & { completedAt: Date | null },
  submitted: Submission & { completed: boolean },
) {
  return (
    saved.exerciseId === submitted.exerciseId &&
    saved.setNumber === submitted.setNumber &&
    sameLoad(saved.weightKg, submitted.weightKg) &&
    saved.reps === submitted.reps &&
    saved.rir === submitted.rir &&
    saved.isWarmup === submitted.isWarmup &&
    saved.isDropSet === submitted.isDropSet &&
    Boolean(saved.completedAt) === submitted.completed
  );
}
