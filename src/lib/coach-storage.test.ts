import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

const database = process.env.COACH_TEST_DATABASE_URL;

test("clears invalidate in-flight Coach writes and concurrent memory appends both survive", { skip: !database }, async () => {
  assert.ok(database);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(database).hostname));
  process.env.DATABASE_URL = database;
  process.env.FITLOG_LOCAL = "1";
  const alias = pathToFileURL(require.resolve("next/dist/compiled/server-only/empty.js")).href;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      return specifier === "server-only" ? { url: alias, shortCircuit: true } : next(specifier, context);
    },
  });
  const { clearCoachChat, forgetCoachMemory, getCoachRevisions, saveCoachExchange, saveCoachMemoryNote } =
    await import("./coach-storage").finally(() => hooks.deregister());
  const db = new Client({ connectionString: database });
  await db.connect();
  const owners: number[] = [];

  try {
    for (let i = 0; i < 2; i++) {
      const { rows } = await db.query("INSERT INTO app_users (email) VALUES ($1) RETURNING id", [`${randomUUID()}@coach-fixture.test`]);
      owners.push(rows[0].id);
    }
    const [owner, other] = owners;
    await saveCoachExchange(owner, 0, "Old question", "Old reply");
    await saveCoachMemoryNote(other, 0, "Other account note");
    const before = await getCoachRevisions(owner);
    assert.deepEqual(before, { chatRevision: 0, memoryRevision: 0 });

    await clearCoachChat(owner);
    assert.equal(await saveCoachExchange(owner, before.chatRevision, "Stale question", "Stale reply"), null);
    await saveCoachMemoryNote(owner, before.memoryRevision, "Note from cleared chat", before.chatRevision);
    assert.equal((await db.query("SELECT id FROM coach_messages WHERE user_id = $1", [owner])).rowCount, 0);

    // Clearing an empty profile also invalidates notes from requests already running.
    assert.deepEqual(await forgetCoachMemory(owner, null), { status: "forgotten", notes: [] });
    await saveCoachMemoryNote(owner, before.memoryRevision, "Note from stale insight");
    const current = await getCoachRevisions(owner);
    assert.deepEqual(current, { chatRevision: 1, memoryRevision: 1 });
    await Promise.all([
      saveCoachMemoryNote(owner, current.memoryRevision, "New fixture note 1"),
      saveCoachMemoryNote(owner, current.memoryRevision, "New fixture note 2"),
    ]);

    const { rows: [memory] } = await db.query<{ notes: string[] }>("SELECT notes FROM coach_memory WHERE user_id = $1", [owner]);
    assert.deepEqual([...memory.notes].sort(), ["New fixture note 1", "New fixture note 2"]);
    const [first, second] = memory.notes;
    assert.deepEqual(await forgetCoachMemory(owner, { index: 0, expectedNote: first }), { status: "forgotten", notes: [second] });
    assert.deepEqual(await forgetCoachMemory(owner, { index: 0, expectedNote: first }), { status: "changed" });
    await saveCoachMemoryNote(owner, current.memoryRevision, "Note from before single-note removal");
    const final = await db.query<{ user_id: number; notes: string[] }>(
      "SELECT user_id, notes FROM coach_memory WHERE user_id = ANY($1) ORDER BY user_id", [owners],
    );
    assert.deepEqual(final.rows, [{ user_id: owner, notes: [second] }, { user_id: other, notes: ["Other account note"] }]);
  } finally {
    await db.query("DELETE FROM app_users WHERE id = ANY($1)", [owners]);
    await db.end();
  }
});
