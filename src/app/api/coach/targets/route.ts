import { NextResponse } from "next/server";
import {
  calorieTargetSchema,
  CoachCaloriePayload,
  CoachTargetPayload,
} from "@/lib/coach";
import { getCoachSnapshot } from "@/lib/coach-data";
import { formatCoachSnapshotAsMarkdown } from "@/lib/coach-snapshot-markdown";
import { calculateMacroTargets } from "@/lib/macro-targets";
import { isCoachConfigured, structuredCoachResponse } from "@/lib/openai";
import { requireAppUser } from "@/lib/app-user";
import { isRateLimited } from "@/lib/rate-limit";

export async function POST() {
  const user = await requireAppUser();
  if (!isCoachConfigured()) {
    return NextResponse.json(
      { error: "Add OPENAI_API_KEY in Vercel to enable Fitlog Coach." },
      { status: 503 }
    );
  }
  if (isRateLimited(`coach-targets:${user.id}`, { max: 20, windowMs: 10 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const snapshot = await getCoachSnapshot({ userId: user.id, days: 28 });
  const { profile } = snapshot;
  if (!profile.currentWeightKg || !profile.heightCm || !profile.ageYears) {
    return NextResponse.json(
      { error: "Add your current weight, height, and age in Settings first." },
      { status: 400 }
    );
  }

  try {
    const proposal = await structuredCoachResponse<CoachCaloriePayload>({
      name: "fitlog_target_recommendation",
      schema: calorieTargetSchema,
      task: `Recommend one conservative daily calorie target for this adult user's stated goal.
Use their current weight, goal weight, height, age, biological sex, target weekly change, workout schedule, completed training, Garmin total expenditure, actual intake, and weight trend when available.
Prefer observed Garmin and weight-trend evidence over a generic activity multiplier. When evidence is missing, clearly lower dataQuality and explain the uncertainty.
For body recomposition, prioritize a modest sustainable deficit. Do not recommend crash dieting or compensatory restriction.
Do not calculate or discuss the macro split; Fitlog calculates protein, fat, and carbohydrate deterministically after you establish calories. Return a whole-number daily calorie target and concise rationale bullets.`,
      data: formatCoachSnapshotAsMarkdown(snapshot),
      maxOutputTokens: 2400,
    });

    if (proposal.targetCalories < 1200 || proposal.targetCalories > 6000) {
      throw new Error("The Coach returned an unsafe calorie target. Please try again.");
    }

    const macros = calculateMacroTargets({
      targetCalories: proposal.targetCalories,
      currentWeightKg: profile.currentWeightKg,
      goal: snapshot.goal,
    });
    const macroRationale = macros.proteinLimitedByCalories
      ? `Protein was capped at ${macros.targetProteinG} g because ${macros.proteinRuleGPerKg} g/kg cannot fit safely within this calorie target after dietary fat.`
      : `Protein is fixed at ${macros.proteinRuleGPerKg} g/kg of current body weight (${profile.currentWeightKg} kg).`;
    const payload: CoachTargetPayload = {
      ...proposal,
      ...macros,
      rationale: [
        macroRationale,
        `Fat receives about ${macros.fatCaloriesPct}% of calories; carbohydrate receives the remaining calories to support training.`,
        ...proposal.rationale.slice(0, 3),
      ],
      caution: macros.proteinLimitedByCalories
        ? [
            proposal.caution,
            "The requested protein rule did not fit this calorie target. Review the calorie target before applying it.",
          ].filter(Boolean).join(" ")
        : proposal.caution,
    };
    const macroCalories =
      payload.targetProteinG * 4 +
      payload.targetCarbsG * 4 +
      payload.targetFatG * 9;
    if (
      payload.targetProteinG < 50 ||
      payload.targetProteinG > 350 ||
      payload.targetCarbsG < 0 ||
      payload.targetCarbsG > 900 ||
      payload.targetFatG < 30 ||
      payload.targetFatG > 250 ||
      !Number.isFinite(macroCalories) ||
      Math.abs(macroCalories - payload.targetCalories) > 4
    ) {
      throw new Error("The Coach returned inconsistent calorie and macro targets. Please try again.");
    }

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Target recommendation failed.",
      },
      { status: 502 }
    );
  }
}
