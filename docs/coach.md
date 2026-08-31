# AI Coach architecture

Last verified: 2026-08-31.

Fitlog Coach is not a fine-tuned or persistently-running model — every request
is a fresh, stateless call to the OpenAI Responses API (`gpt-5-mini` by
default, `OPENAI_MODEL` overrides), steered by a fixed system prompt, a
per-request data snapshot, a per-endpoint task instruction, and a strict JSON
Schema for the reply. The only thing that persists between requests is the
visible chat/insight history already shown in the UI, and the small coach
memory described below.

## Endpoints

All four route through `structuredCoachResponse()` in `src/lib/openai.ts`
with different tasks and schemas (`src/lib/coach.ts`):

- `POST /api/coach/chat` — freeform Q&A. Includes the last 10 stored messages
  as conversation history.
- `POST /api/coach/insights` — `daily` / `weekly` / `post_workout`. Cached per
  `sourceKey` (e.g. `daily:2026-08-31`) unless `refresh: true` is sent, so a
  page load never forces a new model call.
- `POST /api/coach/meals` — meal ideas from today's remaining macros.
- `POST /api/coach/targets` — proposes a calorie number only; macros are
  computed deterministically afterward by `calculateMacroTargets()` and
  re-validated for internal consistency before the response is returned. A
  proposal is never applied automatically — `settings/page.tsx` requires a
  separate, explicit "apply" action from the user.

## Data sent to the model

`getCoachSnapshot()` (`src/lib/coach-data.ts`) aggregates ~28 days (14 for
daily/meals) of workouts (warmups/drops already excluded), nutrition, body
weight, Garmin health/expenditure, cardio sessions, schedule, routine
targets, training-plan/deload state, a deterministically-computed
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
- `isRateLimited()` (`src/lib/rate-limit.ts`) throttles chat/insights/meals/
  targets per user (in-memory, best-effort — see that file's own caveat about
  serverless instance boundaries).

## Main implementation files

- `src/lib/openai.ts`: `structuredCoachResponse()`, the safety system prompt.
- `src/lib/coach.ts`: payload types and JSON Schemas per endpoint.
- `src/lib/coach-data.ts`: `getCoachSnapshot()`, `saveCoachMemoryNote()`.
- `src/lib/coach-snapshot-markdown.ts`: snapshot → Markdown formatter.
- `src/lib/coach-memory.ts`: pure, tested memory append/trim logic.
- `src/app/api/coach/`: chat, insights, meals, targets, memory routes.
- `src/app/(app)/coach/page.tsx`, `src/components/CoachDashboardCard.tsx`,
  `src/components/WorkoutCoach.tsx`, `src/components/CoachInsightCard.tsx`:
  UI surfaces.
