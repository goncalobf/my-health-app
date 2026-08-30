---
name: audit-fitlog
description: Perform a broad read-only Fitlog audit for functional defects, account isolation, unsafe health logic, privacy, mobile regressions, or release risk. Use for code reviews, security reviews, bug hunts, and pre-release audits that require substantial exploration; not for a single obvious fix.
context: fork
agent: fitlog-reviewer
---

Audit the requested scope: $ARGUMENTS

If no scope is supplied, review the current branch/diff against `origin/main`. Do not edit files or mutate external systems.

1. Trace affected flows from UI through API ownership and validation to schema/domain logic.
2. Prioritize account isolation; invalid or destructive inputs; deterministic health/training rules; AI privacy; Garmin/food upstream boundaries; mobile/PWA behavior; and delivery risk.
3. Confirm warmups and drop sets are excluded from every working-set consumer and that no flow fabricates zero-value sets.
4. Run proportionate non-mutating checks and distinguish reproduced findings from suspicions.
5. Report severity, exact evidence, impact, remediation, checks run, and remaining coverage gaps.
