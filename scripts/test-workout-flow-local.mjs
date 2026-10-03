/** Regression checks against the disposable local app/database only. Run after npm run dev:local. */
import assert from "node:assert/strict";
import fs from "node:fs";
import pg from "pg";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
const base = "http://localhost:3210";
const db = new pg.Client({
  connectionString: "postgresql://fitlog:fitlog@localhost:55432/fitlog",
});
const exerciseIds = [],
  routineIds = [],
  sessionIds = [],
  findings = [];
let browser, userId;
async function api(path, method = "GET", body) {
  const r = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.ok(r.ok, `Local API failed: ${method} ${path} ${r.status}`);
  return r.json();
}
async function fixture(sets = 3, movements = 1) {
  const r = await api("/api/routines", "POST", {
    name: "Synthetic workout review",
  });
  routineIds.push(r.id);
  for (const eid of exerciseIds.slice(0, movements))
    await api(`/api/routines/${r.id}/exercises`, "POST", {
      exerciseId: eid,
      targetSets: sets,
      minReps: 8,
      maxReps: 12,
      targetRirMin: 1,
      targetRirMax: 2,
      restSeconds: 120,
      targetWeightKg: null,
    });
  return r.id;
}
async function session(routineId) {
  const s = await api("/api/sessions", "POST", { routineId });
  sessionIds.push(s.id);
  return s.id;
}
async function visit(page, sid) {
  await page.goto(`${base}/workouts/session/${sid}`);
  await page
    .getByRole("button", { name: "Workout overview", exact: true })
    .waitFor();
  await page.waitForLoadState("networkidle");
}
async function enter(page, weight = "50") {
  await page.getByRole("textbox", { name: "Weight", exact: true }).fill(weight);
  await page.getByRole("textbox", { name: "Reps", exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Reps in reserve 2", exact: true })
    .click();
}
async function log(page) {
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await page.getByRole("button", { name: "Next set", exact: true }).waitFor();
}
try {
  await db.connect();
  const rows = (
    await db.query("SELECT id FROM app_users WHERE email='local@fitlog.test'")
  ).rows;
  assert.equal(rows.length, 1);
  userId = rows[0].id;
  for (const suffix of ["A", "B", "C"]) {
    const row = (
      await db.query(
        "INSERT INTO exercises(owner_user_id,name,muscle_group) VALUES($1,$2,'Chest') RETURNING id",
        [userId, `Synthetic ${suffix} ${randomUUID().slice(0, 6)}`],
      )
    ).rows[0];
    exerciseIds.push(row.id);
  }
  const catalog = await api("/api/exercises");
  assert.ok(
    exerciseIds.every((id) => catalog.some((e) => e.id === id)),
    "Local app/database mismatch; no HTTP mutations permitted",
  );
  const names = exerciseIds.map((id) => catalog.find((e) => e.id === id).name);
  browser = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const r = await fixture();
  let sid = await session(r);
  await visit(page, sid);
  // Fresh planned sets carry the last working load without inventing observations.
  await enter(page, "55");
  await log(page);
  await page.getByRole("button", { name: "Next set", exact: true }).click();
  const secondLoad = await page
    .getByRole("textbox", { name: "Weight", exact: true })
    .inputValue();
  assert.equal(secondLoad, "55");
  findings.push({
    fixed: "next-set-load-carries-forward",
    enteredFirstLoad: 55,
    nextLoad: secondLoad,
  });
  // Saving one set must not hide the unsaved draft of another set.
  sid = await session(r);
  await visit(page, sid);
  await enter(page, "57");
  await page.getByRole("button", { name: "Go to set 2", exact: true }).click();
  await enter(page, "50");
  await log(page);
  const status = await page.getByRole("status").allTextContents();
  assert.ok(status.some((s) => s.includes("Edits pending")));
  let dialogs = 0;
  const dismiss = async (d) => {
    dialogs++;
    await d.dismiss();
  };
  page.on("dialog", dismiss);
  await page.getByRole("button", { name: "Exit workout", exact: true }).click();
  assert.equal(dialogs, 1);
  assert.ok(page.url().endsWith(`/workouts/session/${sid}`));
  page.off("dialog", dismiss);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Exit workout", exact: true }).click();
  await page.waitForURL("**/workouts");
  await visit(page, sid);
  assert.equal(
    await page
      .getByRole("textbox", { name: "Weight", exact: true })
      .inputValue(),
    "",
  );
  findings.push({
    fixed: "unrelated-draft-keeps-warning",
    dialogs,
    remainingSavedRows: (await api(`/api/sessions/${sid}`)).loggedSets.length,
  });
  // Losing a response after commit must not duplicate the row on retry.
  sid = await session(r);
  await visit(page, sid);
  await enter(page, "50");
  let dropResponse = true;
  await page.route(`**/api/sessions/${sid}/sets`, async (route) => {
    if (route.request().method() === "POST" && dropResponse) {
      dropResponse = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Log set", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await log(page);
  const saved = (await api(`/api/sessions/${sid}`)).loggedSets.filter(
    (s) => !s.isWarmup && !s.isDropSet && s.setNumber === 1,
  );
  assert.equal(saved.length, 1);
  findings.push({
    fixed: "lost-response-retry-is-idempotent",
    savedWorkingRows: saved.length,
  });
  await page.unroute(`**/api/sessions/${sid}/sets`);
  // Removing the first unlogged set selects the next pending one.
  sid = await session(r);
  await visit(page, sid);
  await page
    .getByRole("button", { name: "Remove this set", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.body.textContent.includes("sets skipped/removed"),
  );
  const current = await page
    .locator('[aria-label^="Go to set"][aria-current="true"]')
    .getAttribute("aria-label");
  assert.equal(current, "Go to set 2");
  findings.push({ fixed: "remove-set-selects-next-pending", current });
  // Rest resumes in the new exercise order, with a valid cursor.
  const reorderRoutine = await fixture(1, 3);
  sid = await session(reorderRoutine);
  await visit(page, sid);
  await enter(page);
  await log(page);
  await page
    .getByRole("button", { name: "Workout overview", exact: true })
    .click();
  const handle = page.getByRole("button", {
    name: `Reorder ${names[1]}`,
    exact: true,
  });
  const target = page.getByRole("button", {
    name: `Reorder ${names[2]}`,
    exact: true,
  });
  const from = await handle.boundingBox(),
    to = await target.boundingBox();
  assert.ok(from && to);
  const reordered = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/sessions/${sid}`) &&
      r.request().method() === "PATCH",
  );
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + to.height / 2, {
    steps: 20,
  });
  await page.mouse.up();
  await (await reordered).finished();
  await page.waitForFunction(
    () =>
      !Array.from(document.querySelectorAll("[role=status]")).some(
        (e) => e.textContent === "Saving…",
      ),
  );
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await page
    .getByRole("button", { name: "Close overview", exact: true })
    .click();
  try {
    await page
      .getByRole("button", { name: "Close overview", exact: true })
      .waitFor({ state: "hidden", timeout: 1500 });
  } catch {
    await page
      .getByRole("button", { name: "Close overview", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Next set", exact: true }).click();
  assert.equal(
    await page.getByText("Every set is logged", { exact: true }).count(),
    0,
  );
  await page.getByText(names[2], { exact: true }).waitFor();
  const rowsAfter = (await api(`/api/sessions/${sid}`)).loggedSets;
  assert.equal(rowsAfter.length, 1);
  findings.push({
    fixed: "reorder-during-rest-advances-to-new-next-exercise",
    completedRows: rowsAfter.length,
    prescribedRows: 3,
  });
  await page.screenshot({
    path: ".context/workout-fixes-next-exercise.png",
    fullPage: true,
  });
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await visit(page, sid);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    assert.equal(overflow, false);
  }
  // A manually entered future weight wins over automatic carry-forward.
  sid = await session(r);
  await visit(page, sid);
  await page.getByRole("button", { name: "Go to set 2", exact: true }).click();
  await enter(page, "42");
  await page.getByRole("button", { name: "Go to set 1", exact: true }).click();
  await enter(page, "55");
  await log(page);
  await page.getByRole("button", { name: "Next set", exact: true }).click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Weight", exact: true })
      .inputValue(),
    "42",
  );
  // Drops do not become the suggested weight for the next working set.
  sid = await session(r);
  await visit(page, sid);
  await enter(page, "50");
  await page.getByRole("button", { name: "Drop set", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard this drop", exact: true })
    .waitFor();
  await enter(page, "35");
  await log(page);
  await page.getByRole("button", { name: "Next set", exact: true }).click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Weight", exact: true })
      .inputValue(),
    "50",
  );
  // Zero added weight remains a real value, not an unknown/empty field.
  sid = await session(r);
  await visit(page, sid);
  await enter(page, "0");
  await log(page);
  await page.getByRole("button", { name: "Next set", exact: true }).click();
  assert.equal(
    await page
      .getByRole("textbox", { name: "Weight", exact: true })
      .inputValue(),
    "0",
  );
  // Concurrent retries share one database row; legitimate drops have distinct keys.
  const retrySid = await session(r);
  const payload = {
    exerciseId: exerciseIds[0],
    setNumber: 1,
    weightKg: 50,
    reps: 10,
    rir: 2,
    completed: true,
    clientRequestId: randomUUID(),
  };
  const retries = await Promise.all(
    Array.from({ length: 3 }, () =>
      api(`/api/sessions/${retrySid}/sets`, "POST", payload),
    ),
  );
  assert.equal(new Set(retries.map((x) => x.id)).size, 1);
  const conflict = await fetch(`${base}/api/sessions/${retrySid}/sets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, reps: 11 }),
  });
  assert.equal(conflict.status, 409);
  const d1 = await api(`/api/sessions/${retrySid}/sets`, "POST", {
    ...payload,
    clientRequestId: randomUUID(),
    isDropSet: true,
    weightKg: 40,
  });
  const d2 = await api(`/api/sessions/${retrySid}/sets`, "POST", {
    ...payload,
    clientRequestId: randomUUID(),
    isDropSet: true,
    weightKg: 30,
  });
  assert.notEqual(d1.id, d2.id);
  const warmup = {
    ...payload,
    clientRequestId: randomUUID(),
    setNumber: 1001,
    isWarmup: true,
    weightKg: 20,
  };
  const w1 = await api(`/api/sessions/${retrySid}/sets`, "POST", warmup);
  const w2 = await api(`/api/sessions/${retrySid}/sets`, "POST", warmup);
  assert.equal(w1.id, w2.id);
  const secondSession = await session(r);
  const separate = await api(
    `/api/sessions/${secondSession}/sets`,
    "POST",
    payload,
  );
  assert.notEqual(separate.id, retries[0].id);
  assert.equal(separate.sessionId, secondSession);
  const unavailable = await fetch(`${base}/api/sessions/2147483647/sets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(unavailable.status, 404);
  findings.push({
    fixed: "concurrent-retries-deduplicated",
    changedReplayRejected: true,
    dropsPreserved: true,
    warmupRetryDeduplicated: true,
    requestKeyScopedToSession: true,
  });
  fs.writeFileSync(
    ".context/workout-fixes-results.json",
    JSON.stringify(findings, null, 2),
  );
  console.log(JSON.stringify(findings));
} finally {
  fs.writeFileSync(
    ".context/workout-fixes-results.json",
    JSON.stringify(findings, null, 2),
  );
  if (browser) await browser.close();
  if (sessionIds.length)
    await db.query(
      "DELETE FROM sessions WHERE user_id=$1 AND id=ANY($2::int[])",
      [userId, sessionIds],
    );
  if (routineIds.length)
    await db.query(
      "DELETE FROM routines WHERE user_id=$1 AND id=ANY($2::int[])",
      [userId, routineIds],
    );
  if (exerciseIds.length)
    await db.query(
      "DELETE FROM exercises WHERE owner_user_id=$1 AND id=ANY($2::int[])",
      [userId, exerciseIds],
    );
  await db.end();
}
