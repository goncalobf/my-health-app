---
name: migrate-fitlog-database
description: Design, generate, review, dry-run, apply, and verify a safe Drizzle/Neon migration for Fitlog. Use whenever schema.ts changes, a backfill is needed, ownership is added, or the user asks to migrate a development or production database.
---

# Migrate the Fitlog database

## Prepare

1. Inspect `git status --short`, `src/db/schema.ts`, `drizzle/meta/_journal.json`, the latest migration, and the exact target environment.
2. Determine whether the operation is schema-only, a data backfill, or both. Identify row counts, nullability, ownership, uniqueness, and rollback risks before writing SQL.
3. Append any backfill to the generated file as its own `--> statement-breakpoint` statement so it applies in the same transaction as the schema change. `drizzle/0012` is the reference: existing accounts are marked onboarded so a new gate never traps them.
4. Preview deployments read the production database, so apply before a preview or a merge depends on the new shape.
3. Require explicit authorization before touching production. Confirm the target from configuration without printing connection strings or secret values.

## Create and review

1. Modify the Drizzle schema first.
2. Run `npm run db:generate` and review every generated statement.
3. Never modify or reorder an already-applied migration. Never use `db:push` in production.
4. For existing rows, backfill deterministically before adding `NOT NULL`, uniqueness, or foreign-key constraints.
5. For multi-user data, include `user_id` in ownership and uniqueness design. Never assign private rows to an arbitrary account.
6. Make reruns safe where possible. If SQL is intentionally one-shot, document the preconditions and verification query.

## Validate and apply

1. Run tests, lint, and build for the related code.
2. Load the intended environment without echoing it, then run:
   `node --env-file=.env.local scripts/run-migration.mjs drizzle/<migration>.sql --dry-run`
3. Confirm the dry run executed every statement and rolled back intentionally.
4. Only after authorization, run the same command without `--dry-run` against the exact target.
5. Verify schema shape, relevant row counts, ownership distribution, uniqueness, and foreign-key joins. Query aggregates, not private payloads.
6. Report the migration filename, statement count, target, dry-run result, apply result, and post-migration checks. Do not claim success if verification is incomplete.
