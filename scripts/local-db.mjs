/**
 * Sets up the throwaway local database used by `npm run dev:local`.
 *
 * Replays every migration in drizzle/ against the local Postgres container and
 * seeds a demo account with enough history that every screen has something to
 * show. Never point this at a real database: `reset` drops the schema.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL to the local database first.");
if (!/localhost|127\.0\.0\.1/.test(url)) {
  throw new Error("Refusing to run: DATABASE_URL is not a local database.");
}

const command = process.argv[2] ?? "setup";
const client = new pg.Client({ connectionString: url });
await client.connect();

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};
const at = (offsetDays, hour = 18) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

async function migrate() {
  const dir = path.join(process.cwd(), "drizzle");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(path.join(dir, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      try {
        await client.query(trimmed);
      } catch (error) {
        // Replaying history onto a fresh database occasionally repeats an
        // object; anything else is a real problem.
        if (!/already exists|duplicate/i.test(error.message)) {
          throw new Error(`${file}: ${error.message}`);
        }
      }
    }
  }
  console.log(`Replayed ${files.length} migrations.`);
}

const EXERCISES = [
  ["Barbell Bench Press", "Chest", "barbell", 2.5],
  ["Incline Dumbbell Press", "Chest", "dumbbell", 2],
  ["Overhead Press", "Shoulders", "barbell", 2.5],
  ["Cable Lateral Raise", "Shoulders", "cable", 1],
  ["Triceps Pushdown", "Arms", "cable", 2.5],
  ["Barbell Row", "Back", "barbell", 2.5],
  ["Lat Pulldown", "Back", "cable", 2.5],
  ["Face Pull", "Back", "cable", 1],
  ["Barbell Curl", "Arms", "barbell", 1.25],
  ["Back Squat", "Legs", "barbell", 5],
  ["Romanian Deadlift", "Legs", "barbell", 5],
  ["Leg Press", "Legs", "machine", 5],
];

const ROUTINES = [
  ["Push A", ["Barbell Bench Press", "Overhead Press", "Incline Dumbbell Press", "Cable Lateral Raise", "Triceps Pushdown"]],
  ["Pull A", ["Barbell Row", "Lat Pulldown", "Face Pull", "Barbell Curl"]],
  ["Legs A", ["Back Squat", "Romanian Deadlift", "Leg Press"]],
];

/** Working weights that visibly progress, so charts and records have shape. */
const START_WEIGHT = {
  "Barbell Bench Press": 70, "Overhead Press": 42.5, "Incline Dumbbell Press": 26,
  "Cable Lateral Raise": 9, "Triceps Pushdown": 30, "Barbell Row": 65,
  "Lat Pulldown": 55, "Face Pull": 20, "Barbell Curl": 27.5,
  "Back Squat": 90, "Romanian Deadlift": 80, "Leg Press": 150,
};

async function seed() {
  const { rows: [user] } = await client.query(
    `INSERT INTO app_users (auth_user_id, email, name, role, status, joined_at)
     VALUES ('local-dev-user', 'local@fitlog.test', 'Local Tester', 'owner', 'active', now())
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );
  const userId = user.id;

  const exerciseIds = {};
  for (const [name, group, equipment] of EXERCISES) {
    const { rows } = await client.query(
      `INSERT INTO exercises (name, muscle_group, equipment, source, external_id)
       VALUES ($1,$2,$3,'local',$1)
       ON CONFLICT (source, external_id) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name, group, equipment]
    );
    exerciseIds[name] = rows[0].id;
  }

  await client.query(
    `INSERT INTO settings (user_id, goal, goal_started_on, current_weight_kg, goal_weight_kg,
                           height_cm, age_years, biological_sex, target_calories,
                           target_protein_g, target_carbs_g, target_fat_g,
                           target_weekly_change_pct, onboarded_at)
     VALUES ($1,'recomposition',$2,82,76,180,30,'male',2450,197,255,68,-0.25, now())
     ON CONFLICT (user_id) DO UPDATE SET onboarded_at = now()`,
    [userId, iso(-28)]
  );
  await client.query(
    `INSERT INTO training_plan_state (user_id, plan_name, block_started_on)
     VALUES ($1,'PPL 6-day A/B',$2) ON CONFLICT (user_id) DO NOTHING`,
    [userId, iso(-28)]
  );

  const routineIds = {};
  for (const [index, [name, members]] of ROUTINES.entries()) {
    const { rows } = await client.query(
      `INSERT INTO routines (user_id, name, position) VALUES ($1,$2,$3) RETURNING id`,
      [userId, name, index]
    );
    routineIds[name] = rows[0].id;
    for (const [position, exercise] of members.entries()) {
      const increment = EXERCISES.find((e) => e[0] === exercise)[3];
      await client.query(
        `INSERT INTO routine_exercises
           (routine_id, exercise_id, position, target_sets, target_reps, min_reps, max_reps,
            weight_increment_kg, rest_seconds, target_rir_min, target_rir_max, is_anchor)
         VALUES ($1,$2,$3,3,10,8,12,$4,120,1,2,$5)`,
        [routineIds[name], exerciseIds[exercise], position, increment, position === 0]
      );
    }
  }

  const week = [routineIds["Push A"], routineIds["Pull A"], routineIds["Legs A"],
                routineIds["Push A"], routineIds["Pull A"], routineIds["Legs A"], null];
  for (const [index, routineId] of week.entries()) {
    await client.query(
      `INSERT INTO workout_schedule (user_id, day_of_week, routine_id) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, day_of_week) DO UPDATE SET routine_id = EXCLUDED.routine_id`,
      [userId, index + 1, routineId]
    );
  }

  // Nine finished sessions over three weeks, adding a little each time.
  const order = ["Push A", "Pull A", "Legs A"];
  let sessionCount = 0;
  for (let block = 0; block < 3; block++) {
    for (const [slot, routine] of order.entries()) {
      const daysAgo = -(20 - block * 7 - slot * 2);
      const { rows: [session] } = await client.query(
        `INSERT INTO sessions (user_id, routine_id, name, started_at, finished_at)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [userId, routineIds[routine], routine, at(daysAgo, 18), at(daysAgo, 19)]
      );
      for (const exercise of ROUTINES.find((r) => r[0] === routine)[1]) {
        const increment = EXERCISES.find((e) => e[0] === exercise)[3];
        const weight = START_WEIGHT[exercise] + block * increment;
        for (let setNumber = 1; setNumber <= 3; setNumber++) {
          await client.query(
            `INSERT INTO session_sets
               (session_id, exercise_id, set_number, weight_kg, reps, rir, completed_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [session.id, exerciseIds[exercise], setNumber, weight,
             12 - setNumber, 1 + (setNumber % 2), at(daysAgo, 18)]
          );
        }
      }
      sessionCount++;
    }
  }

  for (let weeksAgo = 4; weeksAgo >= 0; weeksAgo--) {
    await client.query(
      `INSERT INTO bodyweight_logs (user_id, day, weight_kg) VALUES ($1,$2,$3)`,
      [userId, iso(-weeksAgo * 7), 83.4 - (4 - weeksAgo) * 0.35]
    );
  }

  const foods = [
    ["Oats, rolled", 80, 303, 11, 54, 5.5, "breakfast"],
    ["Whey protein", 30, 118, 24, 2, 1.5, "breakfast"],
    ["Chicken breast, cooked", 200, 330, 62, 0, 7.2, "lunch"],
    ["White rice, cooked", 250, 325, 6.7, 71, 0.7, "lunch"],
    ["Greek yogurt 2%", 200, 146, 20, 7.2, 3.8, "snack"],
  ];
  for (const [name, grams, kcal, protein, carbs, fat, meal] of foods) {
    await client.query(
      `INSERT INTO nutrition_logs (user_id, day, meal, name, quantity_g, calories, protein_g, carbs_g, fat_g)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, iso(0), meal, name, grams, kcal, protein, carbs, fat]
    );
  }

  await client.query(
    `INSERT INTO expenditure_logs (user_id, day, total_calories) VALUES ($1,$2,$3)
     ON CONFLICT DO NOTHING`,
    [userId, iso(0), 2780]
  ).catch(() => {});

  console.log(
    `Seeded local account: ${EXERCISES.length} exercises, ${ROUTINES.length} routines, ${sessionCount} finished sessions.`
  );
}

if (command === "reset") {
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log("Local schema dropped.");
  await migrate();
  await seed();
} else if (command === "fresh-account") {
  await client.query(
    `UPDATE settings SET onboarded_at = NULL
      WHERE user_id = (SELECT id FROM app_users WHERE email = 'local@fitlog.test')`
  );
  console.log("Local account marked as not onboarded; reload to see onboarding.");
} else {
  await migrate();
  await seed();
}

await client.end();
