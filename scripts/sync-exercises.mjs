// Synchronizes Fitlog's catalog with the public-domain free-exercise-db dataset.
// The source revision is pinned so production seeds remain reproducible.
import { neon } from "@neondatabase/serverless";

const SOURCE = "free-exercise-db";
const SOURCE_REVISION = "b0eed061e1c832b3ed815fbaa4b45b3cdc14df49";
const DATASET_URL =
  `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${SOURCE_REVISION}/dist/exercises.json`;
const IMAGE_ROOT =
  `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${SOURCE_REVISION}/exercises`;

// Preserve the user's concise exercise names while linking them to the closest
// equivalent demonstration in the source catalog.
const IMAGE_ALIASES = {
  "Back Squat": "Barbell_Full_Squat",
  "Barbell Row": "Bent_Over_Barbell_Row",
  "Bench Press": "Barbell_Bench_Press_-_Medium_Grip",
  "Cable Flies (Up to Bottom)": "Cable_Crossover",
  "Cable Lateral Raises": "Standing_Low-Pulley_Deltoid_Raise",
  "Cross-Cable Reverse Fly": "Cable_Rear_Delt_Fly",
  Deadlift: "Barbell_Deadlift",
  "Hammer Curl": "Hammer_Curls",
  "Hip Thrust": "Barbell_Hip_Thrust",
  "Lat Pulldown": "Wide-Grip_Lat_Pulldown",
  "Lateral Raise": "Side_Lateral_Raise",
  "Leg Curl": "Lying_Leg_Curls",
  "Overhead Cable Tricep Extension": "Cable_Rope_Overhead_Triceps_Extension",
  "Overhead Press": "Standing_Military_Press",
  "Pull-up": "Pullups",
  "Push-up": "Pushups",
  "Standing Calf Raise": "Standing_Calf_Raises",
};

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
  const imagePath = Array.isArray(item.images) ? item.images[0] : null;
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
    imageUrl:
      typeof imagePath === "string"
        ? `${IMAGE_ROOT}/${imagePath.split("/").map(encodeURIComponent).join("/")}`
        : null,
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
        WITH matched_local AS (
          UPDATE exercises
          SET image_url = ${exercise.imageUrl},
            muscle_group = coalesce(muscle_group, ${exercise.muscleGroup}),
            equipment = coalesce(equipment, ${exercise.equipment}),
            category = coalesce(category, ${exercise.category})
          WHERE lower(name) = lower(${exercise.name})
            AND (source IS NULL OR source <> ${SOURCE})
          RETURNING id
        )
        INSERT INTO exercises (
          name, muscle_group, equipment, category, source, external_id, image_url
        )
        SELECT ${exercise.name}, ${exercise.muscleGroup}, ${exercise.equipment},
          ${exercise.category}, ${SOURCE}, ${exercise.externalId}, ${exercise.imageUrl}
        WHERE NOT EXISTS (SELECT 1 FROM matched_local)
        ON CONFLICT (source, external_id) DO UPDATE SET
          name = excluded.name,
          muscle_group = excluded.muscle_group,
          equipment = excluded.equipment,
          category = excluded.category,
          image_url = excluded.image_url
        RETURNING (xmax = 0) AS inserted
      `)
    );
    for (const rows of results) {
      if (rows[0]?.inserted === true) inserted++;
      else if (rows.length > 0) updated++;
    }
  }

  const catalogById = new Map(catalog.map((exercise) => [exercise.externalId, exercise]));
  let aliased = 0;
  for (const [localName, externalId] of Object.entries(IMAGE_ALIASES)) {
    const match = catalogById.get(externalId);
    if (!match?.imageUrl) continue;
    const rows = await sql`
      UPDATE exercises
      SET image_url = ${match.imageUrl}
      WHERE lower(name) = lower(${localName})
        AND image_url IS NULL
      RETURNING id
    `;
    aliased += rows.length;
  }

  return { total: catalog.length, inserted, updated, aliased };
}

async function main() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Set DATABASE_URL (or POSTGRES_URL) first.");
  const result = await syncExerciseLibrary(neon(url));
  console.log(
    `Exercise library synced: ${result.total} source records, ` +
      `${result.inserted} added, ${result.updated} refreshed, ` +
      `${result.aliased} local names linked.`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
