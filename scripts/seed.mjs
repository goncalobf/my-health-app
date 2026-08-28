// Seeds a starter exercise library and default settings.
// Run after `npm run db:push` with DATABASE_URL set: `npm run seed`.
import { neon } from "@neondatabase/serverless";

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
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM exercises`;
  if (count > 0) {
    console.log(`Exercises already present (${count}) — skipping seed.`);
  } else {
    for (const [name, muscle] of EXERCISES) {
      await sql`INSERT INTO exercises (name, muscle_group) VALUES (${name}, ${muscle})`;
    }
    console.log(`Seeded ${EXERCISES.length} exercises.`);
  }
  await sql`INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  console.log("Ensured settings row.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
