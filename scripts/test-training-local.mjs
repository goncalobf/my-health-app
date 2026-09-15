/** Integration + mobile regression checks. Only the disposable local app/database. */
import assert from "node:assert/strict";
import pg from "pg";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
const base = "http://localhost:3210";
const client = new pg.Client({
  connectionString: "postgresql://fitlog:fitlog@localhost:55432/fitlog",
});
await client.connect();
const routineIds = [];
const sessionIds = [];
let otherUser;
let browser;
let markerId;
let localUserId;
let previousDeload;
async function request(path, method = "GET", body, status = 200) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(res.status, status, `${method} ${path}: unexpected status`);
  return res.json();
}
async function createRoutine(name, exerciseId, fields = {}) {
  const routine = await request("/api/routines", "POST", { name }, 201);
  routineIds.push(routine.id);
  const slot = await request(
    `/api/routines/${routine.id}/exercises`,
    "POST",
    {
      exerciseId,
      targetSets: 3,
      minReps: 8,
      maxReps: 12,
      targetWeightKg: 80,
      weightIncrementKg: 1.25,
      targetRirMin: 1,
      targetRirMax: 2,
      equipmentProfile: {
        machine: "Synthetic test press",
        setup: "Seat 3",
        loading: "total",
        availableLoads: [80, 81.25, 82.5],
      },
      muscleProfile: { direct: ["Chest"], indirect: ["Triceps"] },
      ...fields,
    },
    201,
  );
  return { routine, slot };
}
async function start(routineId) {
  const session = await request("/api/sessions", "POST", { routineId }, 201);
  sessionIds.push(session.id);
  return session;
}
try {
  const local = await client.query(
    "SELECT id FROM app_users WHERE email='local@fitlog.test'",
  );
  assert.equal(
    local.rows.length,
    1,
    "Seed the disposable local database first",
  );
  localUserId = local.rows[0].id;
  const markerName = `Regression press ${randomUUID()}`;
  const marker = await client.query(
    "INSERT INTO exercises (owner_user_id,name,muscle_group) VALUES ($1,$2,'Chest') RETURNING id",
    [localUserId, markerName],
  );
  markerId = marker.rows[0].id;
  // Before ANY HTTP mutation, prove the app reads this exact disposable DB and account.
  const library = await request("/api/exercises");
  assert.ok(
    library.some((e) => e.id === markerId && e.name === markerName),
    "Refusing mutations: app is not connected to the disposable local test account",
  );
  const exerciseId = markerId;
  const { routine: a, slot } = await createRoutine(
    "Regression Push A",
    exerciseId,
  );
  const { routine: b } = await createRoutine("Regression Push B", exerciseId, {
    targetSets: 2,
    minReps: 10,
    maxReps: 15,
  });
  const old = await start(a.id);
  for (let n = 1; n <= 3; n++)
    await request(
      `/api/sessions/${old.id}/sets`,
      "POST",
      {
        exerciseId,
        setNumber: n,
        weightKg: 80,
        reps: 12,
        rir: 1,
        completed: true,
      },
      201,
    );
  await request(
    `/api/sessions/${old.id}/sets`,
    "POST",
    {
      exerciseId,
      setNumber: 1001,
      weightKg: 40,
      reps: 10,
      isWarmup: true,
      completed: true,
    },
    201,
  );
  await request(
    `/api/sessions/${old.id}/sets`,
    "POST",
    {
      exerciseId,
      setNumber: 3,
      weightKg: 60,
      reps: 15,
      isDropSet: true,
      completed: true,
    },
    201,
  );
  await request(`/api/sessions/${old.id}`, "PATCH", { finish: true });
  const planState = await client.query(
    "SELECT is_deload FROM training_plan_state WHERE user_id=$1",
    [localUserId],
  );
  previousDeload = planState.rows[0].is_deload;
  await client.query(
    "UPDATE training_plan_state SET is_deload=true WHERE user_id=$1",
    [localUserId],
  );
  const deload = await start(a.id);
  for (let n = 1; n <= 2; n++)
    await request(
      `/api/sessions/${deload.id}/sets`,
      "POST",
      {
        exerciseId,
        setNumber: n,
        weightKg: 40,
        reps: 12,
        rir: 6,
        completed: true,
      },
      201,
    );
  await request(`/api/sessions/${deload.id}`, "PATCH", { finish: true });
  await client.query(
    "UPDATE training_plan_state SET is_deload=$1 WHERE user_id=$2",
    [previousDeload, localUserId],
  );
  assert.equal(
    (await request(`/api/sessions/${deload.id}`)).plan[0].deloadMode,
    true,
  );
  const current = await start(a.id);
  let data = await request(`/api/sessions/${current.id}`);
  assert.equal(data.recommendations[exerciseId].weightKg, 81.25);
  assert.equal(data.lastSets[exerciseId].length, 3);
  const separate = await start(b.id);
  const separateData = await request(`/api/sessions/${separate.id}`);
  assert.equal(separateData.recommendations[exerciseId].action, "start");
  await request(`/api/routines/${a.id}/exercises/${slot.id}`, "PATCH", {
    targetSets: 4,
    minReps: 6,
    maxReps: 10,
  });
  data = await request(`/api/sessions/${current.id}`);
  assert.equal(data.plan[0].targetSets, 3);
  assert.equal(data.plan[0].minReps, 8);
  const historical = await request(`/api/sessions/${old.id}`);
  assert.equal(historical.lastSets[exerciseId], undefined);
  await request(
    `/api/sessions/${current.id}/sets`,
    "POST",
    { exerciseId, setNumber: 1, weightKg: -1, reps: 10 },
    400,
  );
  await request(
    `/api/routines/${a.id}/exercises/${slot.id}`,
    "PATCH",
    { minReps: 99, maxReps: 3 },
    400,
  );
  await request(
    `/api/sessions/${current.id}`,
    "PATCH",
    { prescriptionSnapshot: {} },
    400,
  );
  const foreign = await client.query(
    "INSERT INTO app_users (email,name) VALUES ($1,'Synthetic other account') RETURNING id",
    [`training-test-${Date.now()}@example.test`],
  );
  otherUser = foreign.rows[0].id;
  const fs = await client.query(
    "INSERT INTO sessions (user_id,name) VALUES ($1,'Foreign synthetic') RETURNING id",
    [otherUser],
  );
  await request(`/api/sessions/${fs.rows[0].id}`, "GET", undefined, 404);
  await request(
    `/api/sessions/${fs.rows[0].id}/sets`,
    "POST",
    { exerciseId, setNumber: 1, weightKg: 10, reps: 10 },
    404,
  );
  const fe = await client.query(
    "INSERT INTO exercises (owner_user_id,name) VALUES ($1,'Foreign synthetic exercise') RETURNING id",
    [otherUser],
  );
  await request(
    `/api/sessions/${current.id}/sets`,
    "POST",
    { exerciseId: fe.rows[0].id, setNumber: 1, weightKg: 10, reps: 10 },
    404,
  );
  await request(
    `/api/routines/${a.id}/exercises`,
    "POST",
    { exerciseId: fe.rows[0].id },
    404,
  );
  const fr = await client.query(
    "INSERT INTO routines (user_id,name) VALUES ($1,'Foreign routine') RETURNING id",
    [otherUser],
  );
  const fslot = await client.query(
    "INSERT INTO routine_exercises (routine_id,exercise_id) VALUES ($1,$2) RETURNING id",
    [fr.rows[0].id, fe.rows[0].id],
  );
  await request(
    `/api/routines/${fr.rows[0].id}/exercises/${fslot.rows[0].id}`,
    "PATCH",
    { targetSets: 4 },
    404,
  );
  console.log(
    "API checks passed: snapshots, separate A/B tracks, microloads, warmup/drop exclusions, prior-only history, validation and cross-account denial.",
  );
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/workouts/session/${current.id}`);
  await page.getByRole("button", { name: "Log set", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Reps in reserve 1", exact: true })
      .getAttribute("aria-pressed"),
    "false",
  );
  await page.getByLabel("Weight", { exact: true }).fill("80");
  await page.getByLabel("Reps", { exact: true }).fill("12");
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await page.getByRole("button", { name: "Next set", exact: true }).waitFor();
  data = await request(`/api/sessions/${current.id}`);
  assert.equal(data.loggedSets[0].rir, null);
  await page.reload();
  await page.getByRole("button", { name: "Log set", exact: true }).waitFor();
  assert.ok(
    (await page.locator("body").innerText())
      .toLowerCase()
      .includes("1 of 3 sets"),
  );
  assert.ok(
    (await page.locator("body").innerText()).toLowerCase().includes("set 2"),
  );
  await page.getByText("Warm-up sets · 0 logged", { exact: true }).click();
  await page.getByLabel("Warm-up kg", { exact: true }).fill("40");
  await page.getByLabel("Warm-up reps", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Log warm-up", exact: true }).click();
  await page.getByText("Warm-up sets · 1 logged", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Remove this set", exact: true })
    .click();
  await page.getByText(/sets skipped\/removed/).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Log set", exact: true }).waitFor();
  assert.ok(
    (await page.locator("body").innerText()).toLowerCase().includes("set 3"),
  );
  await mkdir(".context/training-ui", { recursive: true });
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 812 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `Session overflows at ${width}`,
    );
    await page.screenshot({
      path: `.context/training-ui/session-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByLabel("Session context", { exact: true })
    .selectOption("interrupted");
  await page
    .getByText(
      "This session stays in your log but will not change your normal progression baseline.",
      { exact: true },
    )
    .waitFor();
  await page.goto(`${base}/workouts/routines/${a.id}`);
  await page
    .getByText("Effort, machine & muscle settings", { exact: true })
    .click();
  await page.getByLabel("Minimum RIR", { exact: true }).fill("2");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Settings saved", exact: true })
    .waitFor();
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 812 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `Editor overflows at ${width}`,
    );
  }
  await page.screenshot({
    path: ".context/training-ui/editor.png",
    fullPage: true,
  });
  await page.goto(`${base}/workouts/plan`);
  await page
    .getByRole("heading", { name: "Muscle volume · last 7 days" })
    .waitFor();
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 812 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      `Plan overflows at ${width}`,
    );
  }
  await page.screenshot({
    path: ".context/training-ui/plan.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Mobile checks passed: actual RIR unknown, partial resume, skipped-set resume, warmup logging, context exclusion, editor save, 320/375/390 px overflow and no browser exceptions.",
  );
} finally {
  await browser?.close();
  for (const id of sessionIds)
    await client.query("DELETE FROM sessions WHERE id=$1", [id]);
  for (const id of routineIds)
    await client.query("DELETE FROM routines WHERE id=$1", [id]);
  if (otherUser)
    await client.query("DELETE FROM app_users WHERE id=$1", [otherUser]);
  if (markerId)
    await client.query("DELETE FROM exercises WHERE id=$1", [markerId]);
  if (previousDeload !== undefined)
    await client.query(
      "UPDATE training_plan_state SET is_deload=$1 WHERE user_id=$2",
      [previousDeload, localUserId],
    );
  await client.end();
}
