---
paths:
  - "src/**/*.{ts,tsx}"
  - "scripts/**/*"
  - "workers/**/*"
  - "package.json"
  - "package-lock.json"
  - "eslint.config.mjs"
---

# Verification

- Reproduce reported defects when practical and add a focused regression test for deterministic, parsing, normalization, or ordering logic.
- Keep pure domain logic in `src/lib/` so `tsx --test` can cover it without a browser or live database.
- External-service tests use fixtures/mocks; never depend on live Neon, Garmin, OpenAI, USDA, Open Food Facts, Vercel, or production records.
- Ownership work covers authenticated/allowed, unauthenticated or revoked, cross-account, invalid-input, and missing-resource cases.
- UI work is inspected in `npm run dev:local` at mobile width, including empty, loading, error, long-content, keyboard, and safe-area states.
- Run focused tests while iterating, then `npm test` and `npm run lint`. Add `npm run build` for routing, auth, dependencies, configuration, or production-facing changes.
- Do not weaken assertions, suppress unexpected errors, or skip checks to make a handoff green. Report anything not run and why.
