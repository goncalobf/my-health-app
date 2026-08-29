import { neon } from "@neondatabase/serverless";

const PLAN_SOURCE = "ppl-plan-v4";

export const PPL_ROUTINES = [
  {
    name: "Push A",
    legacyName: "Push",
    position: 1,
    notes: "PDF v4 · Chest emphasis · RIR: 2, 1-2, 0, 0, 0, 0-1, 0, 1.",
    exercises: [
      ["Incline Dumbbell Bench Press", "Incline Dumbbell Press", "Chest", "Dumbbell", "Compound", 4, 6, 8, 2.5, 180],
      ["Barbell Bench Press", "Bench Press", "Chest", "Barbell", "Compound", 4, 6, 8, 2.5, 180],
      ["Cable Fly (High-to-Low)", "Cable Flies (Up to Bottom)", "Chest", "Cable", "Isolation", 3, 12, 15, 1, 60],
      ["Cable Lateral Raise", "Cable Lateral Raises", "Shoulders", "Cable", "Isolation", 5, 12, 15, 1, 60],
      ["Cross-Cable Reverse Fly", "Cross-Cable Reverse Fly", "Shoulders", "Cable", "Isolation", 4, 15, 20, 1, 60],
      ["Overhead Cable Triceps Extension", "Overhead Cable Tricep Extension", "Triceps", "Cable", "Isolation", 4, 10, 12, 1, 60],
      ["Rope Triceps Pushdown", "Triceps Pushdown - Rope Attachment", "Triceps", "Cable", "Isolation", 4, 10, 12, 1, 60],
      ["Ab Wheel Rollout", "Ab Roller", "Core", "Other", "Strength", 2, 8, 12, 1, 60],
    ],
  },
  {
    name: "Pull A",
    legacyName: "Pull",
    position: 2,
    notes: "PDF v4 · Vertical/width emphasis · RIR: 1, 2 (never failure), 0, 0, 0-1, 0.",
    exercises: [
      ["Weighted Pull-Up", "Weighted Pull Ups", "Back", "Bodyweight", "Compound", 4, 6, 8, 2.5, 180],
      ["Barbell Bent-Over Row", "Bent Over Barbell Row", "Back", "Barbell", "Compound", 4, 6, 8, 2.5, 180],
      ["Cable Pullover", "Rope Straight-Arm Pulldown", "Back", "Cable", "Isolation", 3, 12, 15, 1, 60],
      ["Reverse Pec Deck", "Reverse Machine Flyes", "Shoulders", "Machine", "Isolation", 4, 15, 20, 1, 90],
      ["EZ-Bar Curl", "EZ-Bar Curl", "Biceps", "E-Z Curl Bar", "Isolation", 4, 8, 10, 1, 60],
      ["Hammer Curl", "Hammer Curl", "Biceps", "Dumbbell", "Isolation", 3, 10, 12, 1, 60],
    ],
  },
  {
    name: "Legs A",
    legacyName: "Legs",
    position: 3,
    notes: "PDF v4 · Quadriceps emphasis · RIR: 2 (never failure), 1, 0, 0, 0, 0.",
    exercises: [
      ["Barbell Back Squat", "Back Squat", "Quads", "Barbell", "Compound", 5, 5, 8, 2.5, 180],
      ["Hack Squat", "Hack Squat", "Quads", "Machine", "Compound", 4, 10, 12, 2.5, 90],
      ["Leg Extension", "Leg Extensions", "Quads", "Machine", "Isolation", 4, 12, 15, 2.5, 90],
      ["Lying Leg Curl", "Lying Leg Curls", "Hamstrings", "Machine", "Isolation", 4, 10, 12, 2.5, 90],
      ["Standing Calf Raise", "Standing Calf Raise", "Calves", "Machine", "Isolation", 5, 10, 15, 2.5, 90],
      ["Cable Crunch", "Cable Crunch", "Core", "Cable", "Strength", 4, 10, 12, 1, 60],
    ],
  },
  {
    name: "Push B",
    legacyName: null,
    position: 4,
    notes: "PDF v4 · Chest/shoulders · Dumbbell lateral raise and face pull are a superset with 60s between pairs · RIR: 1, 1, 0, 1, 0, 0, 0-1, 0-1, 0.",
    exercises: [
      ["Incline Dumbbell Bench Press", "Incline Dumbbell Press", "Chest", "Dumbbell", "Compound", 4, 8, 10, 2.5, 180],
      ["Dumbbell Bench Press", "Dumbbell Bench Press", "Chest", "Dumbbell", "Compound", 4, 8, 10, 2.5, 180],
      ["Cable Fly (Low-to-High)", "Low Cable Crossover", "Chest", "Cable", "Isolation", 3, 12, 15, 1, 60],
      ["Standing Barbell Overhead Press", "Standing Military Press", "Shoulders", "Barbell", "Compound", 3, 6, 8, 2.5, 180],
      ["Dumbbell Lateral Raise", "Side Lateral Raise", "Shoulders", "Dumbbell", "Isolation", 3, 12, 15, 1, 60],
      ["Machine Lateral Raise", "Seated Side Lateral Raise", "Shoulders", "Machine", "Isolation", 3, 15, 20, 2.5, 90],
      ["Face Pull", "Face Pull", "Shoulders", "Cable", "Isolation", 4, 15, 20, 1, 60],
      ["EZ-Bar Skull Crusher", "EZ-Bar Skullcrusher", "Triceps", "E-Z Curl Bar", "Isolation", 4, 8, 10, 1, 60],
      ["Single-Arm Overhead Cable Extension", "Cable Rope Overhead Triceps Extension", "Triceps", "Cable", "Isolation", 3, 12, 15, 1, 60],
    ],
  },
  {
    name: "Pull B",
    legacyName: null,
    position: 5,
    notes: "PDF v4 · Horizontal/thickness emphasis · RIR: 2 (never failure), 0-1, 0-1, 0, 0, 0, 1.",
    exercises: [
      ["Chest-Supported T-Bar Row", "Lying T-Bar Row", "Back", "Other", "Compound", 4, 8, 10, 2.5, 180],
      ["Wide-Grip Lat Pulldown", "Wide-Grip Lat Pulldown", "Back", "Cable", "Compound", 4, 8, 10, 2.5, 90],
      ["Single-Arm Dumbbell Row", "One-Arm Dumbbell Row", "Back", "Dumbbell", "Compound", 3, 10, 12, 2.5, 180],
      ["Prone Incline Dumbbell Rear Delt Fly", "Bent Over Dumbbell Rear Delt Raise With Head On Bench", "Shoulders", "Dumbbell", "Isolation", 4, 15, 20, 1, 60],
      ["Incline Dumbbell Curl", "Incline Dumbbell Curl", "Biceps", "Dumbbell", "Isolation", 4, 10, 12, 1, 60],
      ["Cable Preacher Curl", "Cable Preacher Curl", "Biceps", "Cable", "Isolation", 2, 12, 15, 1, 60],
      ["Pallof Press", "Pallof Press", "Core", "Cable", "Strength", 3, 10, 12, 1, 60],
    ],
  },
  {
    name: "Legs B",
    legacyName: null,
    position: 6,
    notes: "PDF v4 · Posterior chain/glutes · RIR: 2 (never failure), 1, 0-1, 0, 0-1, 0, 0.",
    exercises: [
      ["Barbell Romanian Deadlift", "Romanian Deadlift", "Hamstrings", "Barbell", "Compound", 4, 6, 8, 2.5, 180],
      ["Bulgarian Split Squat", "Split Squat with Dumbbells", "Quads", "Dumbbell", "Compound", 4, 8, 10, 2.5, 180],
      ["Hip Thrust", "Hip Thrust", "Glutes", "Barbell", "Compound", 4, 8, 12, 2.5, 180],
      ["Seated Leg Curl", "Seated Leg Curl", "Hamstrings", "Machine", "Isolation", 4, 10, 12, 2.5, 90],
      ["Leg Press (High Foot Placement)", "Leg Press", "Glutes", "Machine", "Compound", 3, 12, 15, 2.5, 90],
      ["Seated Calf Raise", "Seated Calf Raise", "Calves", "Machine", "Isolation", 5, 12, 15, 2.5, 90],
      ["Hanging Leg Raise", "Hanging Leg Raise", "Core", "Bodyweight", "Strength", 3, 10, 15, 1, 60],
    ],
  },
];

function externalId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function applyPplPlan(sql) {
  const active = await sql`
    SELECT id FROM sessions WHERE finished_at IS NULL ORDER BY started_at DESC
  `;
  if (active.length > 0) {
    throw new Error("Finish or discard the active workout before replacing routines.");
  }

  const exerciseMap = new Map();
  for (const routine of PPL_ROUTINES) {
    for (const exercise of routine.exercises) {
      const [name, aliasName, muscleGroup, equipment, category] = exercise;
      exerciseMap.set(name.toLowerCase(), {
        name,
        alias_name: aliasName,
        muscle_group: muscleGroup,
        equipment,
        category,
        external_id: externalId(name),
      });
    }
  }

  const routineRows = PPL_ROUTINES.map((routine) => ({
    name: routine.name,
    legacy_name: routine.legacyName,
    position: routine.position,
    notes: routine.notes,
  }));
  const slotRows = PPL_ROUTINES.flatMap((routine) =>
    routine.exercises.map((exercise, index) => ({
      routine_name: routine.name,
      exercise_name: exercise[0],
      position: index + 1,
      target_sets: exercise[5],
      min_reps: exercise[6],
      max_reps: exercise[7],
      weight_increment_kg: exercise[8],
      rest_seconds: exercise[9],
    }))
  );
  const scheduleRows = [
    { day_of_week: 1, routine_name: "Push A" },
    { day_of_week: 2, routine_name: "Pull A" },
    { day_of_week: 3, routine_name: "Legs A" },
    { day_of_week: 4, routine_name: "Push B" },
    { day_of_week: 5, routine_name: "Pull B" },
    { day_of_week: 6, routine_name: "Legs B" },
    { day_of_week: 7, routine_name: null },
  ];

  const [result] = await sql`
    WITH input_exercises AS (
      SELECT * FROM json_to_recordset(${JSON.stringify([...exerciseMap.values()])}::json)
      AS x(name text, alias_name text, muscle_group text, equipment text,
        category text, external_id text)
    ),
    existing_exercises AS (
      SELECT DISTINCT ON (lower(x.name)) e.id, x.name
      FROM input_exercises x
      JOIN exercises e ON lower(e.name) = lower(x.name)
      ORDER BY lower(x.name), (e.source IS NULL) DESC, e.id
    ),
    inserted_exercises AS (
      INSERT INTO exercises (
        name, muscle_group, equipment, category, source, external_id,
        image_url, notes
      )
      SELECT x.name, x.muscle_group, x.equipment, x.category,
        ${PLAN_SOURCE}, x.external_id,
        (
          SELECT image_url FROM exercises alias
          WHERE lower(alias.name) = lower(x.alias_name)
            AND alias.image_url IS NOT NULL
          ORDER BY (alias.source IS NULL) DESC, alias.id
          LIMIT 1
        ),
        'Added from Plano de Hipertrofia PPL 6 dias FINAL v4.'
      FROM input_exercises x
      WHERE NOT EXISTS (
        SELECT 1 FROM existing_exercises e WHERE lower(e.name) = lower(x.name)
      )
      ON CONFLICT (source, external_id) DO UPDATE SET
        name = excluded.name,
        muscle_group = excluded.muscle_group,
        equipment = excluded.equipment,
        category = excluded.category,
        image_url = coalesce(excluded.image_url, exercises.image_url),
        notes = excluded.notes
      RETURNING id, name
    ),
    resolved_exercises AS (
      SELECT id, name FROM existing_exercises
      UNION ALL
      SELECT id, name FROM inserted_exercises
    ),
    input_routines AS (
      SELECT * FROM json_to_recordset(${JSON.stringify(routineRows)}::json)
      AS x(name text, legacy_name text, position integer, notes text)
    ),
    existing_routines AS (
      SELECT DISTINCT ON (lower(x.name)) r.id, x.name
      FROM input_routines x
      JOIN routines r ON lower(r.name) = lower(x.name) AND r.archived = false
      ORDER BY lower(x.name), r.id
    ),
    renamed_routines AS (
      UPDATE routines r
      SET name = x.name, notes = x.notes, position = x.position, archived = false
      FROM input_routines x
      WHERE x.legacy_name IS NOT NULL
        AND lower(r.name) = lower(x.legacy_name)
        AND r.archived = false
        AND NOT EXISTS (
          SELECT 1 FROM existing_routines e WHERE lower(e.name) = lower(x.name)
        )
      RETURNING r.id, r.name
    ),
    inserted_routines AS (
      INSERT INTO routines (name, notes, archived, position)
      SELECT x.name, x.notes, false, x.position
      FROM input_routines x
      WHERE NOT EXISTS (
        SELECT 1 FROM existing_routines e WHERE lower(e.name) = lower(x.name)
      )
      AND NOT EXISTS (
        SELECT 1 FROM renamed_routines r WHERE lower(r.name) = lower(x.name)
      )
      RETURNING id, name
    ),
    refreshed_routines AS (
      UPDATE routines r
      SET notes = x.notes, position = x.position, archived = false
      FROM input_routines x
      WHERE lower(r.name) = lower(x.name)
      RETURNING r.id, r.name
    ),
    resolved_routines AS (
      SELECT id, name FROM refreshed_routines
      UNION
      SELECT id, name FROM renamed_routines
      UNION
      SELECT id, name FROM inserted_routines
    ),
    input_slots AS (
      SELECT * FROM json_to_recordset(${JSON.stringify(slotRows)}::json)
      AS x(routine_name text, exercise_name text, position integer,
        target_sets integer, min_reps integer, max_reps integer,
        weight_increment_kg real, rest_seconds integer)
    ),
    deleted_slots AS (
      DELETE FROM routine_exercises
      WHERE routine_id IN (SELECT id FROM resolved_routines)
      RETURNING id
    ),
    inserted_slots AS (
      INSERT INTO routine_exercises (
        routine_id, exercise_id, position, target_sets, target_reps,
        min_reps, max_reps, target_weight_kg, weight_increment_kg, rest_seconds
      )
      SELECT r.id, e.id, s.position, s.target_sets, s.max_reps,
        s.min_reps, s.max_reps, NULL, s.weight_increment_kg, s.rest_seconds
      FROM input_slots s
      JOIN resolved_routines r ON lower(r.name) = lower(s.routine_name)
      JOIN resolved_exercises e ON lower(e.name) = lower(s.exercise_name)
      CROSS JOIN (SELECT count(*) FROM deleted_slots) deletion_guard
      RETURNING id
    ),
    input_schedule AS (
      SELECT * FROM json_to_recordset(${JSON.stringify(scheduleRows)}::json)
      AS x(day_of_week integer, routine_name text)
    ),
    updated_schedule AS (
      INSERT INTO workout_schedule (day_of_week, routine_id)
      SELECT s.day_of_week, r.id
      FROM input_schedule s
      LEFT JOIN resolved_routines r
        ON lower(r.name) = lower(s.routine_name)
      ON CONFLICT (day_of_week) DO UPDATE SET routine_id = excluded.routine_id
      RETURNING day_of_week
    )
    SELECT
      (SELECT count(*)::int FROM inserted_exercises) AS exercises_added,
      (SELECT count(*)::int FROM resolved_routines) AS routines_updated,
      (SELECT count(*)::int FROM inserted_slots) AS slots_added,
      (SELECT count(*)::int FROM updated_schedule) AS schedule_days_updated
  `;

  return result;
}

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Set DATABASE_URL (or POSTGRES_URL) first.");
  const result = await applyPplPlan(neon(url));
  console.log("Applied PPL plan:", result);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
