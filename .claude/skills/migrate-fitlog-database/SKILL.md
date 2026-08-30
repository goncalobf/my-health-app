---
name: migrate-fitlog-database
description: Design, generate, review, dry-run, apply, and verify a Drizzle/Neon migration. Use when schema.ts changes, a backfill is needed, ownership or constraints change, or the user asks to migrate a specific environment.
---

# Migrate Fitlog safely

1. Inspect `git status`, `src/db/schema.ts`, the journal/latest migration, and the exact target. Classify schema, backfill, ownership, nullability, uniqueness, and rollback risk.
2. Require explicit authorization before production access. Resolve configuration without printing secrets or private rows.
3. Change the schema first, run `npm run db:generate`, and review every generated statement. Never edit or reorder an applied migration.
4. Backfill existing data deterministically before required columns or constraints. Never assign private rows to an arbitrary account; keep user-aware keys.
5. Keep schema and backfill in the generated migration transaction using statement breakpoints. Document non-idempotent preconditions.
6. Run related tests, lint, and build, then:
   `node --env-file=.env.local scripts/run-migration.mjs drizzle/<file>.sql --dry-run`
7. Apply without `--dry-run` only after authorization to the confirmed target.
8. Verify schema, aggregate counts, ownership distribution, uniqueness, and critical joins. Report file, target, statements, dry-run/apply results, and residual risk.
