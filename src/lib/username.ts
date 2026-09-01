/**
 * Deterministic username derivation and validation. Kept free of the
 * database so collision resolution (querying for an existing username) can
 * layer on top in app-user.ts / the backfill script without duplicating the
 * base-slug logic.
 */
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

/** Combining diacritical marks (U+0300–U+036F) left behind by NFD normalization. */
function stripCombiningMarks(input: string): string {
  let result = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x0300 && code <= 0x036f) continue;
    result += ch;
  }
  return result;
}

function slugify(part: string): string {
  return stripCombiningMarks(part.toLowerCase().normalize("NFD"))
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** `<first>_<last>` from a display name, or the email's local part as a fallback. */
export function deriveUsernameBase(name: string | null, email: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  let base: string;
  if (parts.length >= 2) {
    base = `${slugify(parts[0])}_${slugify(parts[parts.length - 1])}`;
  } else if (parts.length === 1) {
    base = slugify(parts[0]);
  } else {
    base = slugify(email.split("@")[0] ?? "");
  }
  base = base.replace(/_+/g, "_").slice(0, 24);
  return base || "user";
}

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value);
}
