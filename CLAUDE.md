@AGENTS.md

# Fitlog agent guide

Fitlog is a private-by-default, multi-user, iPhone-first health and resistance-training tracker. It is a Next.js App Router PWA backed by Neon Postgres and deployed on Vercel. Treat this file as the current agent-facing source of truth; parts of `README.md` still describe the former single-password app.

## First actions

1. Read `git status --short`, the relevant source files, and the matching `.claude/rules/` files before editing.
2. Preserve pre-existing worktree changes. Never discard or rewrite a file merely to make the tree clean.
3. For Next.js work, read the relevant installed documentation under `node_modules/next/dist/docs/` as required by `AGENTS.md`. This project uses Next.js 16, whose APIs may differ from prior knowledge.
4. Make the smallest coherent change, then verify it in proportion to risk.

## Commands

```bash
npm install                    # install the locked dependency graph
npm run dev                    # local development
npm test                       # Node/tsx unit tests
npm run lint                   # ESLint
npm run build                  # production Next.js build
npm run db:generate            # generate a Drizzle migration from schema changes
npm run db:push                # local/dev schema sync only; do not use for production
npm run db:studio              # inspect the configured database
npm run seed                   # seed the shared exercise library
npm run local:db               # migrate + seed the throwaway local database
npm run dev:local              # run locally with no auth and no login page
npm run plan:ppl               # apply the PPL plan; data-changing script
npm run sync:exercises         # synchronize external exercise data
node --env-file=.env.local scripts/run-migration.mjs drizzle/<file>.sql --dry-run
```

Run targeted unit tests while iterating. Before a normal handoff run `npm test` and `npm run lint`; also run `npm run build` for routing, auth, configuration, dependency, or production-facing changes.

## Local no-auth mode

`npm run dev:local` runs the app on port 3210 against a disposable Postgres
container with Neon Auth switched off, so the UI can be opened and checked
without credentials. It is for looking at the app, not for testing auth.

```bash
docker run -d --name fitlog-local-db -e POSTGRES_PASSWORD=fitlog \
  -e POSTGRES_USER=fitlog -e POSTGRES_DB=fitlog -p 55432:5432 postgres:16-alpine
npm run local:db                  # replay migrations and seed demo history
npm run local:db -- reset         # drop, re-migrate, re-seed
npm run local:db -- fresh-account # clear onboarding to see that flow again
npm run dev:local
```

`isLocalMode()` in `src/lib/local-mode.ts` is the only switch. It requires
`FITLOG_LOCAL=1` **and** no `VERCEL`/`VERCEL_ENV` **and** a non-production
`NODE_ENV`, so it cannot engage on a deployment. `.env.local` pulled from
Vercel contains `VERCEL`, which is why `dev:local` clears it. Never point
`local:db` at a real database; it refuses any non-localhost URL.

## Architecture

- `src/app/(app)/`: authenticated application pages. Its layout calls `requireAppUser()` and renders the shared bottom navigation.
- `src/app/api/`: route handlers. Authentication alone is insufficient: every personal query must also be scoped to the current application user.
- `src/app/auth/[path]/`: custom Neon Auth email/password sign-in and sign-up UI.
- `src/app/access-pending/`: invitation gate and one-time legacy-owner claim flow.
- `src/app/onboarding/`: required one-time goal and body-profile setup for a new account.
- `src/proxy.ts`: Neon Auth middleware. Public asset exclusions are declared in its matcher.
- `src/components/`: client UI and reusable iPhone-oriented components.
- `src/db/schema.ts`: canonical Drizzle schema. SQL migrations in `drizzle/` are the production history.
- `src/lib/app-user.ts`: Neon-session-to-`app_users` mapping and new-member initialization.
- `src/lib/local-mode.ts`: the single guard for local no-auth mode. Nothing else may bypass auth.
- `src/lib/coach-data.ts`: privacy-filtered, user-scoped aggregate supplied to the AI coach.
- `src/lib/macro-targets.ts`, `calorie-targets.ts`, `nutrition-phase.ts`, `progressive-overload.ts`, and
  `training-plan.ts`: deterministic health/training rules. Keep calculations here rather than delegating
  them to a model.
- `src/lib/set-prefill.ts`, `workout-flow.ts`: deterministic rules behind the guided workout screen
  (opening values, drop weights, set grouping and ordering).
- `src/lib/motivation.ts`, `motivation-facts.ts`, `motivation-server.ts`: seeded motivation copy and the
  facts drawn from a user's own working sets.
- `scripts/`: operational scripts. Assume they can mutate configured data unless inspection proves otherwise.

## Authentication and account model

- Neon Auth owns credentials and sessions. `app_users` maps a Neon auth user ID to one numeric Fitlog user ID.
- Access is invitation-controlled by exact, normalized email. The owner manages friends at `/settings/friends` through `/api/invitations`.
- Invited members are linked on first authenticated access and receive blank settings, training-plan state, and seven blank schedule days. They never inherit another user's routines or history.
- The migrated owner is deliberately not auto-linked. `/api/claim-owner` requires the authenticated owner email plus the former `APP_PASSWORD` once before historical records are attached.
- `APP_PASSWORD` is legacy claim proof, not the current login system. `/unlock` only redirects to Neon sign-in. Do not reintroduce shared-password authentication.
- Revoked or uninvited accounts may have a valid Neon session but must not access application data.
- Auth is constructed lazily. Importing `src/lib/auth.ts` must never throw, so a build succeeds without
  secrets; a deployment missing configuration fails closed with `503` rather than serving anything.
- A new account is redirected to `/onboarding` until `settings.onboarded_at` is set.
- Production Neon Auth must trust the exact production origin, currently `https://my-health-app-phi.vercel.app`.

## Data ownership invariants

- Personal root tables carry `user_id`: routines, sessions, nutrition logs, settings, bodyweight, schedule, training state/check-ins, Garmin expenditure, saved foods, meals, measurements, and coach records.
- Child tables inherit ownership through their parent: `routine_exercises` through `routines`; `session_sets` through `sessions`.
- Exercises with `owner_user_id IS NULL` are shared library records. Custom exercises are visible only when `owner_user_id` equals the current user.
- Start each protected route with `requireAppUser()`. Add `user.id` to every select, update, and delete predicate. Validate parent ownership before inserting or mutating child rows.
- For inaccessible IDs, prefer the same `404` response used for absent IDs. Do not reveal another account's resource existence.
- Warmups and drop sets are not working sets. Exclude `is_warmup` and `is_drop_set` from progression,
  personal records, exercise history, training-plan anchors and coach data. A drop shares its parent's
  `set_number`; including one in progression input can trigger a false weight reduction.
- Application-level scoping is the current isolation boundary; do not claim PostgreSQL RLS is enabled.

## Product behavior

- The active workout is a guided one-set-at-a-time flow: prefilled stepper controls, automatic advance to
  the next set while the rest bar counts down, jumpable set pills and an overview sheet. Sets open with
  real values so completing one never silently stores zeroes.
- A drop set ends the current effort lighter with no rest and is stored under its parent set's number.
- Workouts support routines, a fixed Monday-Sunday schedule, rest timers, RIR, double-progression
  recommendations, fatigue check-ins, and deload guidance.
- Signing up requires a one-time onboarding that captures goal and body profile, then derives calories
  deterministically and macros from the existing allocation rules.
- Motivation is a presentation layer only: seeded hard-toned lines over licensed dark photography, plus
  facts computed from the user's own working sets. It never invents a number.
- Nutrition is gram-first and stores per-entry totals. USDA FoodData Central supplies cooked/generic foods; Open Food Facts supplies packaged products and barcodes. External macros are normalized per 100 g before quantity scaling.
- Garmin energy expenditure is entered manually; there is no Garmin OAuth/API integration.
- Body profile, goals, calories, macros, phase start, and adaptive-target preferences live in per-user settings.
- Fat-loss/recomposition protein is deterministic at 2.4 g/kg; maintenance/muscle-gain protein is 2.0 g/kg. Fat receives about 25% of target calories and carbohydrate receives the remainder. Macro calories must remain internally consistent.
- The AI coach uses OpenAI Responses API structured outputs. It may propose calories and explain observations, but deterministic code calculates macros and progression. Nothing is applied without user review.
- Never send progress photos or private measurement notes to OpenAI. Do not log health payloads or model text in production diagnostics.

## UI conventions

- Design for iPhone first, including 320 px-wide screens, then enhance larger layouts.
- Preserve the dark theme, `max-w-lg` app shell, safe-area helpers, and hidden scrollbars.
- Avoid horizontal overflow, clipped fixed controls, hover-only interactions, and undersized touch targets.
- Decimal gram/weight fields must accept both `.` and `,` from iPhone keyboards. Reuse `src/lib/decimal-input.ts`; do not rely on `type="number"` parsing alone.
- Use the shared `.card`, `.btn*`, `.input`, and `.label` classes where practical.
- Motivation posters use `MotivationCard`. Images live in `public/motivation/` and must be free-licence;
  check `premium`/`plus` before adding an Unsplash photo, and record it in `CREDITS.md`.
- Verify visual changes by running `npm run dev:local` and looking at the screen, not by reasoning alone.

## Environment and external services

- Database: `DATABASE_URL` or `POSTGRES_URL`.
- Neon Auth: `NEON_AUTH_BASE_URL` and a 32+ character `NEON_AUTH_COOKIE_SECRET`; `AUTH_SECRET` remains a compatibility fallback.
- Legacy owner claim: `APP_PASSWORD`.
- Coach: server-only `OPENAI_API_KEY`; optional `OPENAI_MODEL` defaults to `gpt-5-mini`.
- Food search: server-only `FDC_API_KEY`; the code falls back to USDA `DEMO_KEY`. Open Food Facts needs no key.
- Time zone: `NEXT_PUBLIC_APP_TIME_ZONE`, currently `Europe/Zurich`.
- Preview deployments have their own `DATABASE_URL`, `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`.
  Preview currently points at the production database, so apply a migration before a preview relies on it.
- Preview URLs stay behind Vercel Authentication. Automation reaches them with the project's protection
  bypass secret in an `x-vercel-protection-bypass` header; do not disable the protection itself.
- `NEON_AUTH_COOKIE_SECRET` and `AUTH_SECRET` are sensitive in Vercel, so `vercel env pull` returns them
  empty. A local production build needs a placeholder value for them.
- Never print, commit, paste, or expose secret values. `.env.local`, `.vercel/`, `.next/`, and `.context/` are local artifacts.

## Git and delivery

- This is commonly used through Conductor worktrees. Keep the current branch name unless the user explicitly requests a rename.
- Diff against `origin/main`. Do not assume a clean worktree, and do not stage unrelated changes.
- Never force-push, rewrite shared history, or use destructive cleanup commands.
- A request to implement does not automatically authorize pushing, production deployment, or a production migration. Require explicit authorization or a clearly applicable standing instruction.
- Production migrations are append-only and must be dry-run transactionally before application. Never use `db:push` against production.
- A release is incomplete until tests, lint, build, deployment status, and focused production smoke tests are reported.

## Reusable Claude skills

- `/implement-fitlog-feature`: build a user-scoped feature across schema, API, UI, and tests.
- `/migrate-fitlog-database`: prepare and safely execute a Drizzle migration.
- `/audit-fitlog`: review bugs, isolation, health logic, and mobile regressions.
- `/release-fitlog`: explicitly authorized commit/push/deploy workflow.

## Definition of done

- Requested behavior works and existing behavior is preserved.
- Account isolation is demonstrated for reads and writes, including nested IDs.
- Input validation and failure responses are intentional.
- Relevant deterministic logic has unit coverage.
- Mobile behavior is checked for changed UI.
- `npm test`, `npm run lint`, and when required `npm run build` pass.
- Schema changes include a reviewed migration and safe rollout notes.
- The final report distinguishes code changes, database changes, deployment changes, verification, and any remaining risk.
