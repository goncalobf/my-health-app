---
paths:
  - "src/lib/macro-targets.ts"
  - "src/lib/nutrition-phase.ts"
  - "src/lib/progressive-overload.ts"
  - "src/lib/training-plan.ts"
  - "src/lib/coach*.ts"
  - "src/lib/openai.ts"
  - "src/app/api/adaptive-targets/route.ts"
  - "src/app/api/coach/**/*.ts"
  - "src/components/*Coach*.tsx"
  - "src/components/NutritionPhaseCard.tsx"
---

# Health calculations and AI coach rules

- Keep numeric recommendations deterministic and unit-tested. The model may propose a calorie target and narrative, but code owns macro allocation, calorie consistency, phase dates, progression, and deload triggers.
- Current macro policy: 2.4 g protein/kg for fat loss or recomposition; 2.0 g/kg for maintenance or muscle gain; about 25% of calories from fat; carbohydrates receive remaining calories. Reconcile rounding within four kcal and flag when protein cannot fit.
- Progressive overload is double progression: increase only after all planned sets reach the top of the range at prescribed RIR; repeat while adding reps; reduce one increment after missing minimum reps in two sessions.
- Exclude warmups and drop sets from every progression, record and history input. A lighter drop inside the progression window reads as a missed rep range and can trigger a false weight reduction.
- Onboarding calories use Mifflin-St Jeor, a single documented activity multiplier, and a goal-sized adjustment, floored so no profile receives an extreme deficit. It is an estimate for a new account with no history; adaptive targets refine it later.
- A set must never be stored with fabricated or zeroed values. Prefill opening weight and reps from the recommendation or last session so completing a set records something true.
- Phase guidance must use the stored start date and observed weight trend. Do not invent universal maximum cut durations or present maintenance breaks as mandatory.
- Adaptive calorie changes need adequate recent coverage and conservative bounds. Never automatically apply a Coach or adaptive proposal without explicit user confirmation.
- Keep medical language cautious: do not diagnose, prescribe medication, recommend extreme restriction, or encourage compensatory behavior. Escalate potentially serious symptoms to professional care.
- `getCoachSnapshot()` must remain user-scoped and aggregate only necessary data. Exclude progress photos and private measurement notes from AI inputs.
- Use structured Responses API output with strict schemas, `store: false`, bounded output tokens, a retry for truncation, and safe diagnostics that exclude health content.
- Add table-driven tests for boundary cases, rounding, insufficient data, missing RIR, duplicated weigh-ins, and phase-date transitions whenever these rules change.
