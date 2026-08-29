import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

const migrationPath = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!migrationPath) throw new Error("Usage: run-migration.mjs <migration.sql> [--dry-run]");

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("Set DATABASE_URL (or POSTGRES_URL) first.");

const source = await readFile(migrationPath, "utf8");
const statements = source
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);
const sql = neon(url);
const queries = statements.map((statement) => sql(statement));

if (dryRun) {
  queries.push(sql('SELECT * FROM "__fitlog_force_rollback__"'));
}

try {
  await sql.transaction(queries);
  if (dryRun) throw new Error("Dry run unexpectedly committed.");
  console.log(`Applied ${statements.length} migration statements.`);
} catch (error) {
  if (dryRun && error && typeof error === "object" && error.code === "42P01") {
    console.log(`Dry run passed; ${statements.length} statements were rolled back.`);
  } else {
    throw error;
  }
}
