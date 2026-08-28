import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
} from "drizzle-orm/pg-core";

// A user-built library of exercises.
export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  muscleGroup: text("muscle_group"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A saved workout plan (e.g. "Push A", "Legs").
export const routines = pgTable("routines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  notes: text("notes"),
  archived: boolean("archived").notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// An exercise slot within a routine, with target prescription.
export const routineExercises = pgTable("routine_exercises", {
  id: serial("id").primaryKey(),
  routineId: integer("routine_id")
    .notNull()
    .references(() => routines.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  targetSets: integer("target_sets").notNull().default(3),
  targetReps: integer("target_reps").notNull().default(10),
  minReps: integer("min_reps").notNull().default(8),
  maxReps: integer("max_reps").notNull().default(12),
  targetWeightKg: real("target_weight_kg"),
  weightIncrementKg: real("weight_increment_kg").notNull().default(2.5),
  restSeconds: integer("rest_seconds").notNull().default(120),
});

// A performed workout instance.
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  routineId: integer("routine_id").references(() => routines.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  notes: text("notes"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  finishedAt: timestamp("finished_at"),
});

// A single logged set within a session.
export const sessionSets = pgTable("session_sets", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  weightKg: real("weight_kg").notNull().default(0),
  reps: integer("reps").notNull().default(0),
  isWarmup: boolean("is_warmup").notNull().default(false),
  completedAt: timestamp("completed_at"),
});

// A logged food entry.
export const nutritionLogs = pgTable("nutrition_logs", {
  id: serial("id").primaryKey(),
  day: date("day").notNull(),
  meal: text("meal").notNull().default("snack"), // breakfast | lunch | dinner | snack
  name: text("name").notNull(),
  barcode: text("barcode"),
  quantityG: real("quantity_g").notNull().default(100),
  calories: real("calories").notNull().default(0),
  proteinG: real("protein_g").notNull().default(0),
  carbsG: real("carbs_g").notNull().default(0),
  fatG: real("fat_g").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A single-row settings table (id is always 1).
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  targetCalories: real("target_calories").notNull().default(2200),
  targetProteinG: real("target_protein_g").notNull().default(160),
  targetCarbsG: real("target_carbs_g").notNull().default(220),
  targetFatG: real("target_fat_g").notNull().default(70),
  goal: text("goal").notNull().default("recomposition"),
  targetWeeklyChangePct: real("target_weekly_change_pct")
    .notNull()
    .default(-0.25),
  adaptiveTargets: boolean("adaptive_targets").notNull().default(true),
  lastTargetReviewAt: timestamp("last_target_review_at"),
  goalWeightKg: real("goal_weight_kg"),
});

// Bodyweight measurements over time.
export const bodyweightLogs = pgTable("bodyweight_logs", {
  id: serial("id").primaryKey(),
  day: date("day").notNull(),
  weightKg: real("weight_kg").notNull(),
});

// Fixed Monday-Sunday training plan. Sunday can intentionally have no routine.
export const workoutSchedule = pgTable("workout_schedule", {
  dayOfWeek: integer("day_of_week").primaryKey(), // 1 = Monday, 7 = Sunday
  routineId: integer("routine_id").references(() => routines.id, {
    onDelete: "set null",
  }),
});

// Daily energy expenditure copied from Garmin Connect.
export const expenditureLogs = pgTable("expenditure_logs", {
  day: date("day").primaryKey(),
  totalCalories: real("total_calories").notNull(),
  activeCalories: real("active_calories"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Reusable foods keep gram-based nutrition while also supporting a serving label.
export const savedFoods = pgTable("saved_foods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  barcode: text("barcode"),
  servingName: text("serving_name"),
  servingGrams: real("serving_grams").notNull().default(100),
  caloriesPer100: real("calories_per_100").notNull().default(0),
  proteinPer100: real("protein_per_100").notNull().default(0),
  carbsPer100: real("carbs_per_100").notNull().default(0),
  fatPer100: real("fat_per_100").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A compact JSON snapshot is intentional: meal templates are private, immutable
// recipes whose items are copied into the daily log when used.
export const mealTemplates = pgTable("meal_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  itemsJson: text("items_json").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const measurementLogs = pgTable("measurement_logs", {
  id: serial("id").primaryKey(),
  day: date("day").notNull(),
  waistCm: real("waist_cm"),
  chestCm: real("chest_cm"),
  armsCm: real("arms_cm"),
  thighsCm: real("thighs_cm"),
  bodyFatPct: real("body_fat_pct"),
  notes: text("notes"),
  photoDataUrl: text("photo_data_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Exercise = typeof exercises.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionSet = typeof sessionSets.$inferSelect;
export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type BodyweightLog = typeof bodyweightLogs.$inferSelect;
export type ExpenditureLog = typeof expenditureLogs.$inferSelect;
export type SavedFood = typeof savedFoods.$inferSelect;
export type MealTemplate = typeof mealTemplates.$inferSelect;
export type MeasurementLog = typeof measurementLogs.$inferSelect;
