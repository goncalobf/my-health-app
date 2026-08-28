// Seeds a starter exercise library and default settings.
// Run after `npm run db:push` with DATABASE_URL set: `npm run seed`.
import { neon } from "@neondatabase/serverless";
import { syncExerciseLibrary } from "./sync-exercises.mjs";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("Set DATABASE_URL (or POSTGRES_URL) first.");
  process.exit(1);
}
const sql = neon(url);

const EXERCISES = [
  ["Bench Press", "Chest"],
  ["Incline Dumbbell Press", "Chest"],
  ["Push-up", "Chest"],
  ["Pull-up", "Back"],
  ["Lat Pulldown", "Back"],
  ["Barbell Row", "Back"],
  ["Deadlift", "Back"],
  ["Overhead Press", "Shoulders"],
  ["Lateral Raise", "Shoulders"],
  ["Barbell Curl", "Biceps"],
  ["Hammer Curl", "Biceps"],
  ["Triceps Pushdown", "Triceps"],
  ["Back Squat", "Quads"],
  ["Leg Press", "Quads"],
  ["Romanian Deadlift", "Hamstrings"],
  ["Leg Curl", "Hamstrings"],
  ["Hip Thrust", "Glutes"],
  ["Standing Calf Raise", "Calves"],
  ["Plank", "Core"],
  ["Hanging Leg Raise", "Core"],
];

const ROUTINES = [
  {
    name: "Push",
    exercises: [
      ["Bench Press", 3, 8, 12, 2.5, 120],
      ["Incline Dumbbell Press", 3, 8, 12, 2, 120],
      ["Overhead Press", 3, 6, 10, 2.5, 150],
      ["Lateral Raise", 3, 12, 20, 1, 75],
      ["Triceps Pushdown", 3, 10, 15, 2.5, 75],
    ],
  },
  {
    name: "Pull",
    exercises: [
      ["Pull-up", 3, 6, 10, 1, 150],
      ["Lat Pulldown", 3, 8, 12, 2.5, 120],
      ["Barbell Row", 3, 6, 10, 2.5, 150],
      ["Barbell Curl", 3, 8, 12, 2, 75],
      ["Hammer Curl", 3, 10, 15, 2, 75],
    ],
  },
  {
    name: "Legs",
    exercises: [
      ["Back Squat", 3, 6, 10, 2.5, 180],
      ["Romanian Deadlift", 3, 8, 12, 2.5, 150],
      ["Leg Press", 3, 10, 15, 5, 150],
      ["Leg Curl", 3, 10, 15, 2.5, 90],
      ["Standing Calf Raise", 3, 10, 15, 2.5, 75],
    ],
  },
];

async function main() {
  for (const [name, muscle] of EXERCISES) {
    await sql`
      INSERT INTO exercises (name, muscle_group)
      SELECT ${name}, ${muscle}
      WHERE NOT EXISTS (
        SELECT 1 FROM exercises WHERE lower(name) = lower(${name})
      )
    `;
  }
  console.log(`Ensured ${EXERCISES.length} starter exercises.`);

  const library = await syncExerciseLibrary(sql);
  console.log(
    `Exercise library synced: ${library.total} source records, ` +
      `${library.inserted} added, ${library.updated} refreshed.`
  );
  await sql`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  await sql`
    UPDATE settings
    SET current_weight_kg = (
      SELECT weight_kg FROM bodyweight_logs
      ORDER BY day DESC, id DESC LIMIT 1
    )
    WHERE current_weight_kg IS NULL
  `;
  console.log("Ensured settings row.");

  const routineIds = new Map();
  for (let routinePosition = 0; routinePosition < ROUTINES.length; routinePosition++) {
    const definition = ROUTINES[routinePosition];
    let [routine] = await sql`
      SELECT id FROM routines
      WHERE lower(name) = lower(${definition.name}) AND archived = false
      ORDER BY id LIMIT 1
    `;
    if (!routine) {
      [routine] = await sql`
        INSERT INTO routines (name, position)
        VALUES (${definition.name}, ${routinePosition + 1})
        RETURNING id
      `;
    }
    routineIds.set(definition.name, routine.id);

    for (let position = 0; position < definition.exercises.length; position++) {
      const [name, sets, minReps, maxReps, increment, rest] =
        definition.exercises[position];
      const [exercise] = await sql`
        SELECT id FROM exercises WHERE lower(name) = lower(${name}) LIMIT 1
      `;
      if (!exercise) continue;
      await sql`
        INSERT INTO routine_exercises (
          routine_id, exercise_id, position, target_sets, target_reps,
          min_reps, max_reps, weight_increment_kg, rest_seconds
        )
        SELECT ${routine.id}, ${exercise.id}, ${position + 1}, ${sets},
          ${maxReps}, ${minReps}, ${maxReps}, ${increment}, ${rest}
        WHERE NOT EXISTS (
          SELECT 1 FROM routine_exercises
          WHERE routine_id = ${routine.id} AND exercise_id = ${exercise.id}
        )
      `;
    }
  }

  const [{ count: scheduleCount }] =
    await sql`SELECT count(*)::int AS count FROM workout_schedule`;
  if (scheduleCount === 0) {
    const plan = ["Push", "Pull", "Legs", "Push", "Pull", "Legs", null];
    for (let index = 0; index < plan.length; index++) {
      const routineId = plan[index] ? routineIds.get(plan[index]) : null;
      await sql`
        INSERT INTO workout_schedule (day_of_week, routine_id)
        VALUES (${index + 1}, ${routineId})
        ON CONFLICT (day_of_week) DO NOTHING
      `;
    }
  }
  console.log("Ensured Push / Pull / Legs routines and weekly schedule.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
