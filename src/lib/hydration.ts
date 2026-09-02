/**
 * Deterministic daily water-intake target. Not a clinical requirement —
 * the commonly cited practical range is 35-40 ml/kg body weight, plus an
 * extra 1-1.5 L/day while loading creatine (the phase where intracellular
 * water uptake is highest). Midpoints of both ranges are used for a single
 * number; the ranges themselves stay in the UI copy for transparency.
 */
const BASELINE_ML_PER_KG = 37.5;
const CREATINE_LOADING_BONUS_LITERS = 1.25;

export interface HydrationTarget {
  baselineLiters: number;
  creatineBonusLiters: number;
  targetLiters: number;
}

export function calculateHydrationTarget({
  weightKg,
  creatineLoading,
}: {
  weightKg: number;
  creatineLoading: boolean;
}): HydrationTarget {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("A valid current weight is required.");
  }
  const baselineLiters = Math.round(weightKg * BASELINE_ML_PER_KG) / 1000;
  const creatineBonusLiters = creatineLoading ? CREATINE_LOADING_BONUS_LITERS : 0;
  return {
    baselineLiters: Math.round(baselineLiters * 10) / 10,
    creatineBonusLiters,
    targetLiters: Math.round((baselineLiters + creatineBonusLiters) * 10) / 10,
  };
}
