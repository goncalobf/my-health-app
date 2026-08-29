---
paths:
  - "src/**/*.{ts,tsx}"
  - "scripts/**/*"
  - "package.json"
  - "package-lock.json"
---

# Testing and verification rules

- Reproduce a bug before fixing it when practical. Add a focused regression test for deterministic or parsing logic.
- Keep pure domain logic in `src/lib/` so it can be tested with `tsx --test` without a browser or live database.
- Run the narrowest relevant test during iteration, then `npm test` and `npm run lint` before handoff.
- Run `npm run build` for changes involving routes, layouts, Server/Client boundaries, auth, environment handling, Next.js config, dependencies, or deployment.
- For API ownership changes, verify allowed, unauthenticated/uninvited, cross-account, invalid-input, and not-found cases. Do not use real private production records as fixtures.
- For external APIs, test normalization and failure handling with fixtures/mocks; do not make unit tests depend on live USDA, Open Food Facts, OpenAI, Neon, or Vercel services.
- For UI changes, inspect at mobile width and cover empty, loading, error, long-label, keyboard, and safe-area states.
- Do not weaken assertions, skip tests, or hide errors to obtain a green result. Report any check that could not be run and why.
