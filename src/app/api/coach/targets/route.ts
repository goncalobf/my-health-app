import { NextResponse } from "next/server";
import { CoachTargetPayload, targetSchema } from "@/lib/coach";
import { getCoachSnapshot } from "@/lib/coach-data";
import { isCoachConfigured, structuredCoachResponse } from "@/lib/openai";

export async function POST() {
  if (!isCoachConfigured()) {
    return NextResponse.json(
      { error: "Add OPENAI_API_KEY in Vercel to enable Fitlog Coach." },
      { status: 503 }
    );
  }

  const snapshot = await getCoachSnapshot({ days: 28 });
  const { profile } = snapshot;
  if (!profile.currentWeightKg || !profile.heightCm || !profile.ageYears) {
    return NextResponse.json(
      { error: "Add your current weight, height, and age in Settings first." },
      { status: 400 }
    );
  }

  try {
    const payload = await structuredCoachResponse<CoachTargetPayload>({
      name: "fitlog_target_recommendation",
      schema: targetSchema,
      task: `Recommend one conservative daily calorie and macro target for this adult user's stated goal.
Use their current weight, goal weight, height, age, biological sex, target weekly change, workout schedule, completed training, Garmin total expenditure, actual intake, and weight trend when available.
Prefer observed Garmin and weight-trend evidence over a generic activity multiplier. When evidence is missing, clearly lower dataQuality and explain the uncertainty.
For body recomposition, prioritize a modest sustainable deficit and enough protein to support resistance training. Do not recommend crash dieting or compensatory restriction.
The calories implied by protein*4 + carbs*4 + fat*9 must be within 8% of targetCalories. Return whole-number daily targets and concise rationale bullets.`,
      data: snapshot,
      maxOutputTokens: 2400,
    });

    const macroCalories =
      payload.targetProteinG * 4 +
      payload.targetCarbsG * 4 +
      payload.targetFatG * 9;
    if (
      payload.targetCalories < 1200 ||
      payload.targetCalories > 6000 ||
      payload.targetProteinG < 50 ||
      payload.targetProteinG > 350 ||
      payload.targetCarbsG < 0 ||
      payload.targetCarbsG > 900 ||
      payload.targetFatG < 30 ||
      payload.targetFatG > 250 ||
      !Number.isFinite(macroCalories) ||
      Math.abs(macroCalories - payload.targetCalories) / payload.targetCalories > 0.08
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
