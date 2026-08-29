// Seeds a starter exercise library and default settings.
// Run after `npm run db:push` with DATABASE_URL set: `npm run seed`.
import { neon } from "@neondatabase/serverless";
import { syncExerciseLibrary } from "./sync-exercises.mjs";
import { applyPplPlan } from "./apply-ppl-plan.mjs";

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
      `${library.inserted} added, ${library.updated} refreshed, ` +
      `${library.aliased} local names linked.`
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

  const [{ count: routineCount }] = await sql`
    SELECT count(*)::int AS count FROM routines WHERE archived = false
  `;
  if (routineCount === 0) {
    const plan = await applyPplPlan(sql);
    console.log("Applied Push / Pull / Legs A/B plan:", plan);
  } else {
    console.log("Existing routines found; left them unchanged.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
