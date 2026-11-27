// A package count or volume does not determine mass. Use only an explicit mass.
export function servingWeightGrams(label: string | null): number | null {
  if (!label) return null;
  const explicitMass = /(?<![\p{L}\d.,+\-/–−×])(\d+(?:[.,]\d+)?|[.,]\d+)\s*(kg|mg|grams?|g)\b(?!\s*\/)/giu;
  const weights = [...label.matchAll(explicitMass)];
  if (weights.length !== 1) return null;
  const [, amount, unit] = weights[0];
  const value = Number(amount.replace(",", "."));
  const metricUnit = unit.toLowerCase();
  const unitInGrams = metricUnit === "kg" ? 1000 : metricUnit === "mg" ? 0.001 : 1;
  const grams = value * unitInGrams;
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

// Earlier versions stored the first number in a label, including item counts.
// Repair that exact case when the same label specifies an unambiguous weight.
export function savedServingWeightGrams(label: string | null, storedGrams: number): number {
  const grams = servingWeightGrams(label);
  if (grams === null || grams === storedGrams) return storedGrams;
  const firstNumber = label?.match(/[\d.,]+/)?.[0];
  return firstNumber && Number(firstNumber.replace(",", ".")) === storedGrams ? grams : storedGrams;
}
