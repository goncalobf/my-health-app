# Training progression and historical context

New workouts capture an immutable prescription snapshot: routine slot, sets,
rep range, target RIR, instructions, rest, machine/setup and muscle mapping.
Changing a routine affects future workouts only. Historical workouts created
before this migration retain their logged observations, but cannot establish an
automatic progression baseline: their original prescription and training phase
are unknown. No historical prescription is invented or backfilled.

## Decisions

- Compare prior, completed, user-owned sessions with the same routine slot,
  prescription and equipment configuration. A/B prescriptions are separate.
- Exclude warm-ups, drops, deloads and sessions explicitly marked as interrupted,
  short-rest, changed-setup or technique-limited. The context applies to the
  whole session, conservatively. Completed observations remain visible in history.
- Evaluate all prescribed numbered working sets, never substitute bonus sets
  for skipped ones. Mixed working loads receive a per-set review message instead
  of a fabricated single-load increase.
- Increase difficulty after all planned sets at the same load reach the upper
  rep bound at the required **reported** RIR. Unknown effort stays unknown.
- Respect the equipment's available load ladder; otherwise use its increment.
  Assistance progresses downward. Bodyweight-only training and equipment limits
  require review. Load arithmetic preserves thousandths of a kilogram.
- Hold the load and suggest a small rep progression otherwise. Two complete,
  comparable exposures missing minimum reps at a challenging reported effort
  can recommend one easier load setting. Interrupted and incomplete sessions
  cannot trigger this reduction.
- Three equal rep totals prompt a review, not a diagnosis of a plateau or an
  automatic volume increase. Review technique, effort, rest and recovery.
- Block week seven prompts review, not a compulsory deload. Two sustained
  fatigue signals can suggest considering a deload: comparable performance
  decline, repeated sleep/appetite concerns, repeated joint concerns. Repeated
  check-ins must be on separate days in the last week. Missing check-ins are
  explicitly unknown. These are configurable programming choices in domain
  code, not experimentally validated diagnostic thresholds.
- Starting a deload affects new workouts only: approximately half the sets and
  at least four RIR, with a comfortable user-selected load. Deloads do not reset
  normal progression history or repeatedly multiply a previous deload load.

The session summary calculates the next exposure from the just-completed workout
when eligible. Its performance best compares against all prior comparable
observations; assistance/bodyweight-only bests are not inferred from a load-based
1RM estimate. Current and previous volume both exclude warm-ups and drops.

## Logging and controls

Resume reconstructs every prescribed set and overlays actual saved rows. Skipped
sets are recorded separately; no zero-valued placeholder observations are saved.
Actual RIR starts unanswered, independently of the displayed target. Completed
set edits require the visible save action. Failed saves display an error and
remain in the current flow; duplicate actions are disabled while saving.

Warm-ups have a separate logger. Machine identity, seat/pads/grip, loading
convention, available weights, effort bounds, technique, failure constraints,
superset group, anchor selection and direct/indirect muscles are editable in each
routine slot. Unknown machine details should be entered from the actual gym,
not inferred from a brand name.

The workout list offers the next routine in list order after the last finished
routine, independent of missed calendar days. It is an alternative to the
weekday schedule, not an automatic six-days-per-week requirement.

## Volume and coach

The plan page compares the current weekly schedule (or one pass through routines
when no schedule exists) with the last 7 days of completed working sets, and
shows 28-day totals. Scheduled volume is the normal prescription before deload
reductions. Direct and indirect contributions remain separate. Fractional volume
uses 0.5 for indirect sets as an explicitly labelled estimate. Without a muscle
mapping the broad exercise muscle group is used; detailed anatomy is not guessed.

The AI coach receives deterministic progression decisions and their reasons.
It explains these outputs and does not calculate replacement loads. No new
photos, measurement notes or other unrelated private data are added to its feed.

## Scientific basis and limits

- [Plotkin et al. (2022)](https://pubmed.ncbi.nlm.nih.gov/36199287/): both load
  and repetition progression were viable in an eight-week trained-participant
  study. It does not validate these exact software thresholds.
- [Refalo et al. (2024)](https://pubmed.ncbi.nlm.nih.gov/38393985/): 1–2 RIR and
  failure produced similar quadriceps hypertrophy, with greater acute fatigue
  at failure in that study. This does not establish one universal optimal RIR.
- [Halperin et al. (2022)](https://pubmed.ncbi.nlm.nih.gov/34542869/): subjective
  remaining-repetition predictions have substantial error and heterogeneity.
- [Pelland et al. (2026)](https://pubmed.ncbi.nlm.nih.gov/41343037/): volume has
  diminishing returns; fractional indirect-set accounting fit the meta-analysis
  better. The 0.5 convention is not an exact biological measurement.
- [Coleman et al. (2024)](https://pubmed.ncbi.nlm.nih.gov/38274324/): one week of
  cessation did not improve hypertrophy and attenuated strength gains in that
  trial. Complete cessation is different from reduced-volume deload training;
  this does not prove deloads unnecessary.

Natural status does not define a universal set cap or required weekly increase.
The system uses recorded performance and recovery, not an assumed natural-lifter
multiplier, wearable readiness score or an automatic volume escalation.

## Migration and verification

`drizzle/0025_mysterious_blockbuster.sql` adds five columns to existing owner-scoped
parent tables. It deletes no data and backfills only empty skipped lists and a
normal-context default; a null snapshot keeps legacy history ineligible despite
that default. Existing app code tolerates the additive columns, so an application
rollback can leave them in place. Do not drop snapshots to roll back code.

Apply the migration before deploying code that queries the new columns. The exact
migration was dry-run with BEGIN/ROLLBACK and then applied and verified against
the disposable local PostgreSQL instance. Production migration and deployment
are separate authorized release steps.

Checks:

```sh
npm test
npm run lint
npm run build
# Requires the disposable local DB and npm run dev:local on port 3210:
node scripts/test-training-local.mjs
```

The integration script uses only fixed localhost endpoints, creates synthetic
fixtures, verifies cross-account denial, and removes its fixtures afterward.
Mobile browser coverage checks 320, 375 and 390 px. Real iPhone keyboards and
installed-PWA behavior still require device testing.
