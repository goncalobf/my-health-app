---
paths:
  - "src/db/**/*"
  - "drizzle/**/*"
  - "drizzle.config.ts"
  - "scripts/*.mjs"
---

# Database rules

- Treat `src/db/schema.ts` as the desired schema and `drizzle/` as immutable production history.
- Generate a new numbered migration with `npm run db:generate`; do not edit an already-applied migration.
- Review generated SQL for destructive operations, table rewrites, nullability changes, foreign-key behavior, ownership backfills, and uniqueness conflicts.
- For a required column on existing data, use an explicit staged/backfill strategy that cannot orphan or misassign records.
- Keep indexes and unique keys user-aware. A value that was globally unique in the single-user app may need a composite user key.
- Use transactions when the provider supports them. Run `scripts/run-migration.mjs <file> --dry-run` against the exact target before any authorized application.
- Never run `npm run db:push` against production. Never modify production data simply to make a test pass.
- After applying a migration, verify schema shape, row counts, ownership distribution, and critical foreign-key joins without printing private data.
- Seed/sync scripts must be idempotent or document why rerunning is safe. Shared exercises use `owner_user_id = NULL`; per-user records must never be seeded into every account accidentally.
