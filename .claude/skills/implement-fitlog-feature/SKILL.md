---
name: implement-fitlog-feature
description: Implement or extend a Fitlog product feature across its Next.js UI, user-scoped route handlers, Drizzle schema, deterministic health logic, and tests. Use for new workout, nutrition, progress, settings, account, or coach capabilities and for changes that touch more than one application layer.
---

# Implement a Fitlog feature

## Establish the change surface

1. Read `CLAUDE.md`, `git status --short`, and the rules matching the files involved.
2. For UI work, start `npm run dev:local` early so the change can be seen as it is built rather than only at the end.
2. Trace the existing page/component to its API handler, schema tables, and relevant domain function before editing.
3. State the behavior, data ownership path, validation rules, mobile states, and whether a migration is required.

## Implement safely

1. Put shared deterministic behavior in a typed `src/lib/` function and keep components focused on presentation and interaction.
2. Start protected handlers with `requireAppUser()` and scope every database operation to `user.id` or a proven user-owned parent.
3. Validate foreign keys before inserts. Allow exercises only when shared (`owner_user_id IS NULL`) or owned by the current user.
4. Parse and bound unknown inputs. Preserve comma/period decimal editing on iPhone for grams and kilograms.
5. Add loading, empty, error, disabled, and long-content UI states. Check the fixed bottom navigation and safe areas.
6. If persistence changes, update `src/db/schema.ts` and invoke `/migrate-fitlog-database`; never patch production ad hoc.
7. If coach behavior changes, keep calculations deterministic and keep photos/private measurement notes out of model inputs.

## Verify

1. Add focused tests for domain logic and the reported regression.
2. Exercise authorized and cross-account paths for user-owned resources.
3. Run targeted tests, then `npm test` and `npm run lint`.
4. Run `npm run build` for routes, auth, configuration, dependencies, or production-facing changes.
5. Inspect changed UI at 320, 375, and 390 px when browser tooling is available.
6. Summarize changed behavior, checks, schema/deployment requirements, and remaining risks. Do not push or deploy unless authorized.
