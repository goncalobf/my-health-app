---
paths:
  - "src/db/**/*"
  - "drizzle/**/*"
  - "drizzle.config.ts"
  - "scripts/run-migration.mjs"
  - "scripts/local-db.mjs"
  - "scripts/seed.mjs"
  - "scripts/sync-*.mjs"
  - "scripts/apply-ppl-plan.mjs"
---

# Database and migrations

- `src/db/schema.ts` is the desired schema; numbered files in `drizzle/` are immutable once applied.
- Change the schema first, run `npm run db:generate`, then review every statement.
- Treat destructive operations, table rewrites, required columns, uniqueness, foreign keys, and ownership backfills as explicit rollout decisions.
- Existing private rows must be backfilled deterministically; never assign them to an arbitrary user. Keep unique keys and indexes user-aware.
- Assume application queries still need ownership predicates even if database RLS is added later.
- Confirm the exact target without printing its URL. Never assume a preview database is isolated from production.
- Run `scripts/run-migration.mjs <file> --dry-run` before an authorized apply; verify schema, aggregate counts, ownership, and critical joins afterward.
- `npm run local:db -- reset` is destructive and valid only for the guarded localhost disposable database.
- Seed/sync scripts must be idempotent or document their one-shot preconditions. Use transactions for multi-step mutations where supported.
