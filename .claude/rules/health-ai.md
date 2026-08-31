---
paths:
  - "src/lib/calorie-targets.ts"
  - "src/lib/macro-targets.ts"
  - "src/lib/nutrition-phase.ts"
  - "src/lib/progressive-overload.ts"
  - "src/lib/training-plan.ts"
  - "src/lib/set-prefill.ts"
  - "src/lib/workout-flow.ts"
  - "src/lib/coach*.ts"
  - "src/lib/openai.ts"
  - "src/app/api/adaptive-targets/route.ts"
  - "src/app/api/coach/**/*.ts"
  - "src/components/*Coach*.tsx"
  - "src/components/NutritionPhaseCard.tsx"
---

# Health calculations and AI coach

- Numeric health and training recommendations are deterministic functions with unit tests. AI supplies explanation, never the source of truth.
- Macro policy is 2.4 g protein/kg for fat loss or recomposition and 2.0 g/kg for maintenance or muscle gain; about 25% of calories goes to fat and carbohydrate receives the remainder. Keep calories internally consistent after rounding.
- Double progression increases load only after every planned working set reaches the top of its range at the prescribed RIR; reduce one increment only after two misses at the minimum.
- Exclude warmups and drop sets from progression, records, plan anchors, history, and coach inputs.
- Never persist fabricated or zeroed sets. Prefill from the recommendation, prior session, or current-session predecessor.
- Onboarding uses Mifflin-St Jeor plus the documented activity/goal adjustment and safety floor; adaptive changes need adequate recent data and conservative bounds.
- Phase advice uses the stored start date and observed trend. Do not invent universal cut limits or make maintenance breaks mandatory.
- A coach/adaptive proposal is never applied without explicit user confirmation. Medical language stays cautious and escalates serious symptoms.
- `getCoachSnapshot()` remains user-scoped and excludes progress photos and private measurement notes; it also includes `coachMemory`, a capped/trimmed list of coach-authored notes that the user can review and delete from the Coach page.
- Coach memory is soft context, never a source of truth: it must never let the model bypass macro/progression math or the explicit-confirmation gate on applying a target. Cap and trim it server-side (`coach-memory.ts`) regardless of what the model returns.
- OpenAI requests use strict structured output, `store: false`, bounded tokens/time, and diagnostics without health or model content. Data sent to the model is Markdown (`coach-snapshot-markdown.ts`), not JSON — extend that formatter, not ad hoc `JSON.stringify`, when the snapshot shape changes.
- Add boundary-focused tests when changing formulas, rounding, dates, RIR, duplicated weigh-ins, prefill, or phase transitions.
