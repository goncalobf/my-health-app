/**
 * One-shot backfill: assigns a username to every app_users row that doesn't
 * have one yet (accounts created before the friends feature). New accounts
 * get a username at creation time (src/lib/app-user.ts) and never need this.
 *
 * Usage:
 *   node scripts/backfill-usernames.mjs [--dry-run]
 */
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("Set DATABASE_URL (or POSTGRES_URL) first.");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");

// Mirrors src/lib/username.ts — kept duplicated since scripts/ stays self-contained.
function stripCombiningMarks(input) {
  let result = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) continue;
    result += ch;
  }
  return result;
}
function slugify(part) {
  return stripCombiningMarks(part.toLowerCase().normalize("NFD"))
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function deriveUsernameBase(name, email) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  let base;
  if (parts.length >= 2) base = `${slugify(parts[0])}_${slugify(parts[parts.length - 1])}`;
  else if (parts.length === 1) base = slugify(parts[0]);
  else base = slugify(email.split("@")[0] ?? "");
  base = base.replace(/_+/g, "_").slice(0, 24);
  return base || "user";
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const { rows } = await client.query(
  `SELECT id, email, name FROM app_users WHERE username IS NULL ORDER BY id`
);
console.log(`${rows.length} account(s) missing a username.`);

const { rows: existingRows } = await client.query(`SELECT username FROM app_users WHERE username IS NOT NULL`);
const taken = new Set(existingRows.map((r) => r.username));

for (const row of rows) {
  const base = deriveUsernameBase(row.name, row.email);
  let candidate = base;
  for (let suffix = 2; taken.has(candidate); suffix++) {
    candidate = `${base.slice(0, 24 - String(suffix).length - 1)}_${suffix}`;
  }
  taken.add(candidate);
  console.log(`  #${row.id} (${row.email}) -> ${candidate}`);
  if (!dryRun) {
    await client.query(`UPDATE app_users SET username = $1 WHERE id = $2`, [candidate, row.id]);
  }
}

console.log(dryRun ? "Dry run: no rows changed." : `Backfilled ${rows.length} account(s).`);
await client.end();
