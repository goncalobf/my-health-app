// Synchronizes Fitlog's catalog with the public-domain free-exercise-db dataset.
// The source revision is pinned so production seeds remain reproducible.
import { neon } from "@neondatabase/serverless";

const SOURCE = "free-exercise-db";
const DATASET_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/b0eed061e1c832b3ed815fbaa4b45b3cdc14df49/dist/exercises.json";

const MUSCLE_NAMES = {
  abdominals: "Core",
  abductors: "Abductors",
  adductors: "Adductors",
  biceps: "Biceps",
  calves: "Calves",
  chest: "Chest",
  forearms: "Forearms",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  lats: "Back",
  "lower back": "Back",
  "middle back": "Back",
  neck: "Neck",
  quadriceps: "Quads",
  shoulders: "Shoulders",
  traps: "Back",
  triceps: "Triceps",
};

function titleCase(value) {
  return value
    .split(" ")
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(" ");
}

function normalizeExercise(item) {
  const primaryMuscle = Array.isArray(item.primaryMuscles)
    ? item.primaryMuscles[0]
    : null;
  return {
    externalId: String(item.id),
    name: String(item.name),
    muscleGroup: primaryMuscle
      ? MUSCLE_NAMES[primaryMuscle] ?? titleCase(primaryMuscle)
      : null,
    equipment:
      typeof item.equipment === "string"
        ? item.equipment === "body only"
          ? "Bodyweight"
          : titleCase(item.equipment)
        : null,
    category:
      typeof item.category === "string" ? titleCase(item.category) : null,
  };
}

export async function syncExerciseLibrary(sql) {
  const response = await fetch(DATASET_URL, {
    headers: { "User-Agent": "Fitlog exercise library sync" },
  });
  if (!response.ok) {
    throw new Error(`Exercise library download failed (${response.status}).`);
  }
  const raw = await response.json();
  if (!Array.isArray(raw) || raw.length < 800) {
    throw new Error("Exercise library response was incomplete.");
  }

  const catalog = raw.map(normalizeExercise);
  let inserted = 0;
  let updated = 0;
  const batchSize = 100;

  for (let offset = 0; offset < catalog.length; offset += batchSize) {
    const batch = catalog.slice(offset, offset + batchSize);
    const results = await sql.transaction((tx) =>
      batch.map((exercise) => tx`
        INSERT INTO exercises (
          name, muscle_group, equipment, category, source, external_id
        )
        SELECT ${exercise.name}, ${exercise.muscleGroup}, ${exercise.equipment},
          ${exercise.category}, ${SOURCE}, ${exercise.externalId}
        WHERE NOT EXISTS (
          SELECT 1 FROM exercises
          WHERE lower(name) = lower(${exercise.name})
            AND (source IS NULL OR source <> ${SOURCE})
        )
        ON CONFLICT (source, external_id) DO UPDATE SET
          name = excluded.name,
          muscle_group = excluded.muscle_group,
          equipment = excluded.equipment,
          category = excluded.category
        RETURNING (xmax = 0) AS inserted
      `)
    );
    for (const rows of results) {
      if (rows[0]?.inserted === true) inserted++;
      else if (rows.length > 0) updated++;
    }
  }

  return { total: catalog.length, inserted, updated };
}

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Set DATABASE_URL (or POSTGRES_URL) first.");
  const result = await syncExerciseLibrary(neon(url));
  console.log(
    `Exercise library synced: ${result.total} source records, ` +
      `${result.inserted} added, ${result.updated} refreshed.`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
