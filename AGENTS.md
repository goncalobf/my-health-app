<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Fitlog agent notes

`CLAUDE.md` is the source of truth for this project; read it before editing.
The points below are the ones most often got wrong.

- **Never throw at module import.** `src/lib/auth.ts` and `src/db/index.ts`
  construct lazily so `next build` succeeds without any environment. A module
  that throws while Next collects page data breaks every deployment that lacks
  secrets, including previews.
- **Warmups and drops are not working sets.** Filter `is_warmup` and
  `is_drop_set` out of progression, records, history, plan anchors and coach
  data. A drop shares its parent's `set_number`.
- **Auth has exactly one bypass**, `isLocalMode()` in `src/lib/local-mode.ts`,
  and it cannot engage on a deployment. Do not add another.
- **Look at UI changes.** `npm run dev:local` runs the app with no login page
  against a disposable seeded database. Screenshot it rather than assuming.
- **Health numbers are deterministic and tested.** Calories, macros,
  progression and phase logic live in `src/lib/` with unit tests. A model may
  narrate them; it may not compute them.
