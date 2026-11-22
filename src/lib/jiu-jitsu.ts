import { z } from "zod";
import { startOfAppDay } from "./utils";

export const JIU_JITSU = "jiu_jitsu";
export const jiuJitsuEfforts = ["easy", "moderate", "hard"] as const;
export type JiuJitsuEffort = (typeof jiuJitsuEfforts)[number];

export const jiuJitsuLog = z.object({
  type: z.literal(JIU_JITSU),
  day: z.string().date(),
  durationSeconds: z.number().int().positive().max(12 * 60 * 60).nullish(),
  effort: z.enum(jiuJitsuEfforts).nullish(),
  notes: z.string().trim().max(1000).nullish(),
}).strict();

// Date-only logs use a time within the selected Fitlog day for sorting.
export function dateJiuJitsuLog(day: string, durationSeconds: number | null, now: Date) {
  const dayStart = startOfAppDay(day).getTime();
  const finished = Math.min(now.getTime(), dayStart + 12 * 60 * 60_000);
  return {
    startedAt: new Date(Math.max(dayStart, finished - (durationSeconds ?? 0) * 1000)),
    finishedAt: new Date(finished),
  };
}
