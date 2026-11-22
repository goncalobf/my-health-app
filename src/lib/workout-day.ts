import { z } from "zod";

export const workoutDayUpdate = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  routineId: z.number().int().positive().max(2147483647).nullable(),
  jiuJitsu: z.boolean().optional(),
}).strict();

export const trainingSuggestion = z.object({
  upcoming: z.array(z.object({
    routineId: workoutDayUpdate.shape.routineId,
    reason: z.string().trim().min(1).max(400),
  }).strict()).min(1).max(3),
}).strict();

export type TrainingSuggestion = z.infer<typeof trainingSuggestion>;

export interface WorkoutDay {
  day: string;
  routines: { id: number; name: string }[];
  choice: { routineId: number | null; jiuJitsu: boolean } | null;
  defaultRoutineId: number | null;
  activeSessionId: number | null;
  completedToday: boolean;
}
