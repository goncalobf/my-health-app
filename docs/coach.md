# AI Coach architecture

Each request calls the OpenAI Responses API (`gpt-5-mini` by default,
`OPENAI_MODEL` overrides). [The coach playbook](coach-playbook.md) defines
coaching behavior. A request receives the opening guidance, the topics named
by its task’s `<!-- Include: ... -->` line, and that task’s instructions. This
keeps specialized requests from carrying unrelated coaching rules.

Keep topic headings at level two and tasks at level three under the final
`Response tasks` section. Use the request’s schema name for the task heading
and exact topic titles in its include line. Editing the playbook updates
coaching behavior after deployment. Fitlog still supplies the data snapshot,
validates the response schema, and computes deterministic values in code.

## Endpoints

These endpoints use `structuredCoachResponse()` in `src/lib/openai.ts`:

- `POST /api/coach/chat` — open-ended conversation guided by the Markdown
  playbook. Includes the last 10 messages as a compact transcript. It sends
  past answers without suggestion buttons or memory metadata and places
  the current question after the app context. Optional follow-ups come from
  the Coach and users can edit them before sending.
- `POST /api/coach/insights` — `daily` / `weekly` / `post_workout`. Cached per
  `sourceKey` (e.g. `daily:2026-08-31`) unless `refresh: true` is sent, so a
  page load never forces a new model call.
- `POST /api/coach/training` — suggests the next one to three days after
  the current saved daily choice. It receives available routine names and
  muscle groups, recent strength, cardio and jiu-jitsu summaries, today’s
  planned mat time, recovery flags, and Garmin sleep recorded in the last seven days.
  The server verifies routine IDs and returns suggestions for display.
- `POST /api/coach/meals` — meal ideas from today's remaining macros.
- `POST /api/coach/targets` — proposes a calorie number only; macros are
  computed deterministically afterward by `calculateMacroTargets()` and
  re-validated for internal consistency before the response is returned. A
  proposal is never applied automatically — `settings/page.tsx` requires a
  separate, explicit "apply" action from the user.

## Data sent to the model

`getCoachSnapshot()` (`src/lib/coach-data.ts`) aggregates ~28 days (14 for
daily/meals) of workouts (warmups/drops already excluded), nutrition, body
weight, Garmin health/expenditure, cardio and jiu-jitsu sessions, schedule, routine
targets, today’s explicit training choice, training-plan/deload state, a deterministically-computed
`nutritionPhase`, and `coachMemory`. It never selects progress photos or
private measurement notes — there is no field to leak.

The snapshot is rendered as **Markdown**, not `JSON.stringify`, by
`formatCoachSnapshotAsMarkdown()` (`src/lib/coach-snapshot-markdown.ts`):
headed sections for scalar data, tables for every array of near-identical
objects (workouts, weight/nutrition/Garmin trends, routine targets, common
foods). Repeated-key JSON is the bulk of the payload for this kind of data,
so this is meaningfully more token-efficient (~47% smaller measured against
seeded local data) and reads more like a spreadsheet than a database dump.
Table cells are escaped (`|` and newlines) so a stray character in a food or
exercise name can't break a row. Extend this formatter when the snapshot
shape changes; do not fall back to ad hoc `JSON.stringify` for part of it.

The **output** stays strict JSON Schema (`text.format.type: "json_schema"`,
`strict: true`) regardless of the input format — that's what lets the UI
render structured insight cards instead of parsing prose.

## Garmin sleep and recovery

Home shows the duration and sleep score for the current Garmin report when
available. Progress → Garmin shows the individual days stored by sync.
The general Coach snapshot and the upcoming-training context both identify
the most recent dated sleep report. They include an earlier mean only when
at least three prior nights have a recorded duration in the seven-day window.
The playbook combines sleep with reported fatigue and recent workouts when
suggesting normal training, an easier session, or a rest day. The Home
guidance can be refreshed after Garmin syncs a new report.
[Sleep and the athlete expert consensus](https://bjsm.bmj.com/content/55/7/356)

## Jiu-jitsu and gym on the same day

Today’s training can include a gym routine, jiu-jitsu, or both. A completed
class can be logged from Today’s training or Log past activity. Date is
required. Duration and self-reported effort are optional. Both coach
snapshots distinguish planned mat time from logged classes and identify
classes on the same day as logged strength training. Private class notes
and calorie estimates stay out of the jiu-jitsu data sent to Coach.

## Coach memory

`coach_memory` is one row per user: a capped, ordered list of short,
coach-authored observations that persist across sessions (e.g. "responds
better to direct language than hedging", not "asked about protein"). It is
soft context, not a source of truth.

- **Writing**: the `chat` and `insight` (all three kinds, including
  `post_workout`) response schemas include an optional `memoryNote` field.
  The model is instructed to leave it `null` most turns and fill it only for
  something durable and non-obvious about the person, never a diagnosis. When
  present, the route calls `saveCoachMemoryNote()`, which appends through the
  pure `appendMemoryNote()` (`src/lib/coach-memory.ts`) — capped server-side
  at 20 notes / ~2000 total characters / 300 characters per note, oldest
  dropped first, regardless of what the model returns.
- **Reading**: `getCoachSnapshot()` includes `coachMemory` in every request.
  The system prompt instructs the model to treat it as soft prior context
  that current data always overrides, and never to restate a memory note as
  if it were a new observation.
- **User control**: `GET`/`DELETE /api/coach/memory` (single-note delete via
  `?index=N`, full clear with no query param) back the "What Coach remembers"
  section on the Coach page — per-note delete plus "Forget everything". This
  is deliberate: something that writes persistent notes about a person needs
  to stay transparent and correctable.

## Guardrails

- Deterministic health math (macros, progressive overload, phase logic) is
  never delegated to the model and memory can never override it — see
  `.claude/rules/health-ai.md`.
- A coach target proposal requires an explicit, separate user action to
  apply; nothing here changes that.
- `store: false` on every OpenAI call. Errors are logged with model name and
  response status/output-types only — never health data or model text.
- `isRateLimited()` (`src/lib/rate-limit.ts`) throttles chat, insights, meals, training suggestions, and
  target proposals per user (in-memory, best-effort — see that file's own caveat about
  serverless instance boundaries).

## Main implementation files

- `src/lib/openai.ts`: `structuredCoachResponse()` and loading the playbook.
- `src/lib/coach.ts`: payload types and JSON Schemas per endpoint.
- `src/lib/coach-data.ts`: `getCoachSnapshot()`, `saveCoachMemoryNote()`.
- `src/lib/coach-snapshot-markdown.ts`: snapshot → Markdown formatter.
- `src/lib/coach-memory.ts`: pure, tested memory append/trim logic.
- `src/app/api/coach/`: chat, insights, meals, targets, training suggestions, and memory routes.
- `src/app/(app)/coach/page.tsx`, `src/components/CoachDashboardCard.tsx`,
  `src/components/WorkoutCoach.tsx`, `src/components/CoachInsightCard.tsx`:
  UI surfaces.
