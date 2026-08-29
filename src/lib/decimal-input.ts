export function normalizeDecimalInput(value: string) {
  const filtered = value.replaceAll(",", ".").replace(/[^\d.]/g, "");
  const decimalIndex = filtered.indexOf(".");
  if (decimalIndex === -1) return filtered;

  return (
    filtered.slice(0, decimalIndex + 1) +
    filtered.slice(decimalIndex + 1).replaceAll(".", "")
  );
}

export function parseDecimalInput(value: string) {
  const parsed = Number(normalizeDecimalInput(value));
  return Number.isFinite(parsed) ? parsed : 0;
}
