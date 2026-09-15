import { z } from "zod";
import { performanceContexts } from "./training-prescription";
// Accept numeric form strings, but never coerce null/blank/boolean into invented zeros.
const numeric = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .min(1)
      .regex(/^\d+(?:[.,]\d+)?$/)
      .transform((v) => Number(v.replace(",", "."))),
  ])
  .pipe(z.number().finite());
const integer = (min: number, max: number) =>
  numeric.pipe(z.number().int().min(min).max(max));
const load = numeric.pipe(z.number().min(0).max(3000));
const nullable = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? null : v), schema.nullable());
export const equipmentSchema = z.object({
  machine: z.string().trim().max(150),
  setup: z.string().trim().max(500),
  loading: z.enum([
    "total",
    "per_side",
    "per_hand",
    "assistance",
    "bodyweight",
  ]),
  availableLoads: z
    .array(load)
    .max(200)
    .transform((v) => [...new Set(v)].sort((a, b) => a - b)),
});
const muscleNames = z
  .array(z.string().trim().min(1).max(60))
  .max(12)
  .transform((v) => [...new Set(v)]);
export const prescriptionFields = z.object({
  targetSets: integer(1, 30),
  targetReps: integer(1, 100),
  minReps: integer(1, 100),
  maxReps: integer(1, 100),
  targetWeightKg: nullable(load),
  weightIncrementKg: numeric.pipe(z.number().min(0.01).max(100)),
  restSeconds: integer(0, 1800),
  targetRirMin: nullable(integer(0, 10)),
  targetRirMax: nullable(integer(0, 10)),
  avoidFailure: z.boolean(),
  instruction: nullable(z.string().trim().max(1000)),
  supersetGroup: nullable(z.string().trim().max(60)),
  isAnchor: z.boolean(),
  position: integer(0, 1000),
  equipmentProfile: equipmentSchema.nullable(),
  muscleProfile: z
    .object({ direct: muscleNames, indirect: muscleNames })
    .nullable(),
});
export const prescriptionPatch = prescriptionFields.partial().strict();
export const validPrescription = prescriptionFields.superRefine((p, ctx) => {
  if (p.minReps > p.maxReps)
    ctx.addIssue({
      code: "custom",
      message: "Minimum reps must not exceed maximum reps",
    });
  if (
    (p.targetRirMin == null) !== (p.targetRirMax == null) ||
    (p.targetRirMin != null &&
      p.targetRirMax != null &&
      p.targetRirMin > p.targetRirMax)
  )
    ctx.addIssue({
      code: "custom",
      message:
        "Enter both RIR bounds in ascending order, or leave both unknown",
    });
  if (p.avoidFailure && (p.targetRirMin == null || p.targetRirMin === 0))
    ctx.addIssue({
      code: "custom",
      message: "Avoid-failure prescriptions need at least 1 RIR",
    });
  if (
    p.muscleProfile?.direct.some((m) => p.muscleProfile?.indirect.includes(m))
  )
    ctx.addIssue({
      code: "custom",
      message: "A muscle cannot be both direct and indirect",
    });
});
export const defaultPrescription = {
  targetSets: 3,
  targetReps: 12,
  minReps: 8,
  maxReps: 12,
  targetWeightKg: null,
  weightIncrementKg: 2.5,
  restSeconds: 120,
  targetRirMin: null,
  targetRirMax: null,
  avoidFailure: false,
  instruction: null,
  supersetGroup: null,
  isAnchor: false,
  position: 0,
  equipmentProfile: null,
  muscleProfile: null,
};
export const setFields = z.object({
  weightKg: load,
  reps: integer(1, 1000),
  rir: nullable(integer(0, 10)),
  isWarmup: z.boolean(),
  isDropSet: z.boolean(),
  completed: z.boolean(),
});
export const setPatch = setFields.partial().strict();
export const createSet = setFields
  .extend({
    exerciseId: integer(1, 2147483647),
    setNumber: integer(1, 100000),
    rir: nullable(integer(0, 10)).default(null),
    isWarmup: z.boolean().default(false),
    isDropSet: z.boolean().default(false),
    completed: z.boolean().default(true),
  })
  .strict()
  .refine(
    (s) => !(s.isWarmup && s.isDropSet),
    "Warmups cannot also be drop sets",
  );
export const sessionPatch = z
  .object({
    name: z.string().trim().min(1).max(150),
    notes: nullable(z.string().max(2000)),
    finish: z.boolean(),
    exerciseOrder: z.array(integer(1, 2147483647)).max(100).nullable(),
    performanceContext: z.enum(performanceContexts),
    skipSet: z.object({
      exerciseId: integer(1, 2147483647),
      setNumber: integer(1, 100000),
    }),
  })
  .partial()
  .strict();
export const createSession = z
  .object({
    routineId: integer(1, 2147483647).nullish(),
    name: z.string().trim().min(1).max(150).optional(),
  })
  .strict();

export const trainingPlanUpdate = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("checkin"),
      sleepPoor: z.boolean(),
      appetiteLow: z.boolean(),
      jointPain: z.boolean(),
      notes: z.string().max(1000).optional(),
    })
    .strict(),
  z
    .object({
      action: z.enum(["start_deload", "finish_deload", "start_new_block"]),
    })
    .strict(),
]);
