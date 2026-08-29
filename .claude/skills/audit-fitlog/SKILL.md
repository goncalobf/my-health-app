---
name: audit-fitlog
description: Audit Fitlog changes or the current application for functional bugs, account-isolation failures, unsafe health calculations, AI privacy issues, mobile usability regressions, and release risks. Use for bug hunts, code reviews, pre-release checks, or requests to find and fix what is not working well.
---

# Audit Fitlog

## Scope and evidence

1. Clarify whether the task is read-only review or includes fixes. Do not mutate external systems during an audit.
2. Inspect `git status --short`, compare the intended range to `origin/main`, and identify pre-existing user changes.
3. Trace affected behavior end to end: UI state -> client request -> route validation -> ownership predicate -> schema -> returned state.

## Review order

1. **Account isolation:** missing `requireAppUser()`, unscoped IDs, nested-resource access, shared/custom exercise visibility, invitation roles, and owner claim behavior.
2. **Data correctness:** invalid numeric coercion, dates/time zone, units, duplicate-day behavior, macro calorie consistency, progression boundaries, and destructive writes. Confirm warmups and drop sets are excluded from every progression, record and history query, and that no path can store a set as zero weight and zero reps.
3. **AI/privacy:** user-scoped snapshots, excluded photos/notes, deterministic calculations, strict structured output, safe errors, and no health logging.
4. **Mobile/PWA:** 320 px overflow, fixed-navigation overlap, safe areas, keyboard/input behavior, long text, touch targets, rest-timer/session flow, and image fallbacks.
5. **Reliability:** upstream timeouts, loading/error/empty states, stale closures/races, route status codes, service worker caching, and environment failures.
6. **Delivery:** migration safety, secret exposure, dependency changes, tests, lint, build, and production smoke coverage.
7. **Auth surface:** `isLocalMode()` remains the only bypass and still cannot engage on a deployment; no module throws at import time; an unconfigured deployment fails closed.
8. **Assets:** anything under `public/motivation/` is free-licence and credited.

## Validate and report

1. Reproduce each likely defect when practical; distinguish verified findings from hypotheses.
2. Rank findings by severity and cite exact files/lines plus user impact.
3. If fixes are authorized, patch the smallest root cause and add regression coverage.
4. Run focused tests, `npm test`, `npm run lint`, and `npm run build` when relevant.
5. For anything visual, run `npm run dev:local` and look at the screen before judging it correct.
5. Re-review the resulting diff for cross-account regressions and unrelated changes.
6. Lead the report with whether the app is ready, then list fixed or open findings, verification, and any checks not performed.
