import {
  pgTable,
  serial,
  text,
  integer,
  real,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// Application access is invitation-controlled. Neon Auth owns credentials and
// sessions; this table maps a Neon user to their private Fitlog data.
export const appUsers = pgTable("app_users", {
  id: serial("id").primaryKey(),
  authUserId: text("auth_user_id").unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("invited"),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  joinedAt: timestamp("joined_at"),
});

// Built-in and user-created exercise library.
export const exercises = pgTable(
  "exercises",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    muscleGroup: text("muscle_group"),
    equipment: text("equipment"),
    category: text("category"),
    source: text("source"),
    externalId: text("external_id"),
    imageUrl: text("image_url"),
    notes: text("notes"),
    ownerUserId: integer("owner_user_id").references(() => appUsers.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("exercises_source_external_id_unique").on(
      table.source,
      table.externalId
    ),
  ]
);

// A saved workout plan (e.g. "Push A", "Legs").
export const routines = pgTable("routines", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
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
  targetRirMin: integer("target_rir_min"),
  targetRirMax: integer("target_rir_max"),
  avoidFailure: boolean("avoid_failure").notNull().default(false),
  instruction: text("instruction"),
  supersetGroup: text("superset_group"),
  isAnchor: boolean("is_anchor").notNull().default(false),
});

// A performed workout instance.
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
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
  rir: integer("rir"),
  isWarmup: boolean("is_warmup").notNull().default(false),
  completedAt: timestamp("completed_at"),
});

// A logged food entry.
export const nutritionLogs = pgTable("nutrition_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
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
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  targetCalories: real("target_calories").notNull().default(2200),
  targetProteinG: real("target_protein_g").notNull().default(160),
  targetCarbsG: real("target_carbs_g").notNull().default(220),
  targetFatG: real("target_fat_g").notNull().default(70),
  goal: text("goal").notNull().default("recomposition"),
  goalStartedOn: date("goal_started_on"),
  targetWeeklyChangePct: real("target_weekly_change_pct")
    .notNull()
    .default(-0.25),
  adaptiveTargets: boolean("adaptive_targets").notNull().default(true),
  lastTargetReviewAt: timestamp("last_target_review_at"),
  currentWeightKg: real("current_weight_kg"),
  goalWeightKg: real("goal_weight_kg"),
  heightCm: real("height_cm"),
  ageYears: integer("age_years"),
  biologicalSex: text("biological_sex").notNull().default("unspecified"),
});

// Bodyweight measurements over time.
export const bodyweightLogs = pgTable("bodyweight_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  weightKg: real("weight_kg").notNull(),
});

// Fixed Monday-Sunday training plan. Sunday can intentionally have no routine.
export const workoutSchedule = pgTable(
  "workout_schedule",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(), // 1 = Monday, 7 = Sunday
    routineId: integer("routine_id").references(() => routines.id, {
      onDelete: "set null",
    }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.dayOfWeek] })]
);

// State for the current training block and its autoregulated deload week.
export const trainingPlanState = pgTable("training_plan_state", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  planName: text("plan_name").notNull().default("PPL 6-day A/B"),
  blockStartedOn: date("block_started_on").notNull(),
  isDeload: boolean("is_deload").notNull().default(false),
  deloadStartedOn: date("deload_started_on"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const trainingCheckins = pgTable(
  "training_checkins",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    sleepPoor: boolean("sleep_poor").notNull().default(false),
    appetiteLow: boolean("appetite_low").notNull().default(false),
    jointPain: boolean("joint_pain").notNull().default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("training_checkins_user_day_unique").on(table.userId, table.day),
  ]
);

// Daily energy expenditure copied from Garmin Connect.
export const expenditureLogs = pgTable(
  "expenditure_logs",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    totalCalories: real("total_calories").notNull(),
    activeCalories: real("active_calories"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.day] })]
);

// Reusable foods keep gram-based nutrition while also supporting a serving label.
export const savedFoods = pgTable("saved_foods", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
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
  userId: integer("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  itemsJson: text("items_json").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const measurementLogs = pgTable("measurement_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
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

// AI output is cached in Fitlog so dashboard reads never require a model call.
// Only aggregated inputs are sent to OpenAI; photos and private notes are excluded.
export const coachInsights = pgTable("coach_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // daily | weekly | post_workout | meal
  sourceKey: text("source_key"),
  payloadJson: text("payload_json").notNull(),
  model: text("model").notNull(),
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const coachMessages = pgTable("coach_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => appUsers.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Exercise = typeof exercises.$inferSelect;
export type AppUser = typeof appUsers.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionSet = typeof sessionSets.$inferSelect;
export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type BodyweightLog = typeof bodyweightLogs.$inferSelect;
export type ExpenditureLog = typeof expenditureLogs.$inferSelect;
export type TrainingPlanState = typeof trainingPlanState.$inferSelect;
export type TrainingCheckin = typeof trainingCheckins.$inferSelect;
export type SavedFood = typeof savedFoods.$inferSelect;
export type MealTemplate = typeof mealTemplates.$inferSelect;
export type MeasurementLog = typeof measurementLogs.$inferSelect;
export type CoachInsight = typeof coachInsights.$inferSelect;
export type CoachMessage = typeof coachMessages.$inferSelect;
