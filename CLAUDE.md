# Fitlog project guide

Fitlog is a multi-user, iPhone-first health, nutrition, strength, and cardio tracker. It uses Next.js App Router, Neon Postgres/Auth, Drizzle, Vercel, OpenAI, and an optional Cloudflare Worker for Garmin authentication.

## Before editing

- Run `git status --short` and inspect the relevant code and tests. Preserve every pre-existing tracked or untracked change.
- Follow the path-scoped rules in `.claude/rules/`; Claude Code loads them when matching files are opened.
- For Next.js changes, follow `AGENTS.md` and read the relevant installed guide under `node_modules/next/dist/docs/`. Do not rely on remembered Next.js APIs.
- Trace existing behavior end to end before changing it. Prefer the smallest coherent fix over a parallel abstraction.

## Non-negotiable invariants

- Private routes call `requireAppUser()` and scope every personal read/write to `user.id` or a proven user-owned parent. Authentication alone is not authorization.
- `src/lib/auth.ts` and `src/db/index.ts` construct lazily. Never make a module throw while Next.js imports it during build or route collection.
- `isLocalMode()` in `src/lib/local-mode.ts` is the only auth bypass. It must never engage on Vercel or in a production build.
- Calories, macros, phase logic, progression, workout flow, and other health numbers are deterministic code in `src/lib/`, with unit tests. Models may narrate results; they do not own calculations.
- Warmups and drop sets are not working sets. Exclude both from progression, records, history, plan anchors, and coach data; a drop shares its parent's `set_number`.
- Never print, commit, or expose secrets, tokens, health payloads, progress photos, private notes, or model conversations.

## Repository map

- `src/app/`: App Router pages and route handlers; `(app)` is the authenticated shell.
- `src/components/`: client UI; inspect changed screens in the local seeded app.
- `src/lib/`: domain logic and external-service adapters.
- `src/db/schema.ts`: desired Drizzle schema; `drizzle/` is append-only production history.
- `scripts/`: operational or data-changing tasks; inspect a script before running it.
- `workers/garmin-auth/`: separate Cloudflare Worker runtime for the Garmin login handshake.

## Common commands

```bash
npm run dev:local      # seeded disposable DB, no login, port 3210
npm run local:db       # migrate and seed the local disposable DB
npm test               # unit tests
npm run lint           # ESLint
npm run build          # production build
npm run db:generate    # generate a new migration from schema changes
```

Use targeted tests while iterating. Before handoff, run `npm test` and `npm run lint`; also run `npm run build` for routes, auth, dependencies, configuration, or production-facing changes. For UI work, run `npm run dev:local` and inspect mobile states rather than inferring them from code.

## Git, database, and delivery

- Compare with `origin/main`; do not rename the active Conductor branch, stage unrelated files, force-push, reset shared history, or discard user changes.
- Never use `db:push` against production or edit an applied migration. Dry-run the exact migration against the exact target before an authorized apply.
- Commit, push, merge, production migration, deployment, and external configuration changes each require explicit authorization. Production ships from `main` through Vercel.
- Keep `.env.local`, `.vercel/`, `.next/`, `.context/`, database dumps, and generated caches out of commits. `.env.example` contains names and placeholders only.

## On-demand context

- Authentication and account lifecycle: `docs/authentication.md`
- Food providers and normalization: `docs/food-data.md`
- Garmin connection and worker boundary: `docs/garmin.md`
- AI Coach data feed and memory: `docs/coach.md`
- Repeated workflows: `/implement-fitlog-feature`, `/migrate-fitlog-database`, `/audit-fitlog`, and user-invoked `/release-fitlog`
