/**
 * Deterministic daily water-intake target. Not a clinical requirement —
 * the commonly cited practical range is 35-40 ml/kg body weight.
 *
 * Creatine changes this only during active loading (typically ~20 g/day):
 * sources cite a clear, quantified extra 1-1.5 L/day on top of baseline,
 * which this uses the midpoint of (1.25 L). Once past loading and onto a
 * 3-5 g/day maintenance dose, sources describe total intake settling back
 * into the same ~2-4 L/day range the baseline formula already produces for
 * a typical adult body weight — no separate quantified maintenance bump is
 * documented, so maintenance intentionally adds nothing on top of baseline
 * rather than inventing an unsourced number.
 */
const BASELINE_ML_PER_KG = 37.5;
const CREATINE_LOADING_BONUS_LITERS = 1.25;

export type CreatinePhase = "none" | "loading" | "maintenance";

export interface HydrationTarget {
  creatinePhase: CreatinePhase;
  baselineLiters: number;
  creatineBonusLiters: number;
  targetLiters: number;
}

export function calculateHydrationTarget({
  weightKg,
  creatinePhase,
}: {
  weightKg: number;
  creatinePhase: CreatinePhase;
}): HydrationTarget {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("A valid current weight is required.");
  }
  const baselineLiters = Math.round(weightKg * BASELINE_ML_PER_KG) / 1000;
  const creatineBonusLiters = creatinePhase === "loading" ? CREATINE_LOADING_BONUS_LITERS : 0;
  return {
    creatinePhase,
    baselineLiters: Math.round(baselineLiters * 10) / 10,
    creatineBonusLiters,
    targetLiters: Math.round((baselineLiters + creatineBonusLiters) * 10) / 10,
  };
}
