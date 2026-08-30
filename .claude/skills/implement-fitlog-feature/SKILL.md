---
name: implement-fitlog-feature
description: Implement a Fitlog feature spanning multiple layers such as UI, user-scoped API, Drizzle schema, deterministic health logic, and tests. Use for cross-stack workout, nutrition, cardio, progress, settings, account, Garmin, or coach work; not for a one-file change.
---

# Implement a cross-stack feature

1. Trace the existing UI, route, ownership path, schema, and domain functions before editing. Define behavior, validation, mobile states, and migration needs.
2. Put shared deterministic behavior in typed `src/lib/` functions. Keep components focused on interaction and presentation.
3. Start private handlers with `requireAppUser()`. Scope roots to `user.id`, prove child ownership through parents, and validate foreign keys before inserts.
4. Parse and bound unknown input. Preserve comma/period decimal editing for grams and kilograms.
5. Cover loading, empty, error, disabled, long-content, keyboard, and safe-area states. Run `npm run dev:local` early for UI work.
6. For persistence changes, update `src/db/schema.ts` and invoke `/migrate-fitlog-database`; do not patch production ad hoc.
7. Keep coach calculations deterministic and health payloads minimal; never send photos or measurement notes to the model.
8. Add focused tests, verify cross-account behavior, run the project gates, and report code/schema/deployment effects separately. Do not push or deploy without authorization.
