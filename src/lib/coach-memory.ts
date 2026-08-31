/**
 * Appends a durable observation to the coach's persistent memory of one user,
 * trimming from the oldest end so the list never grows unbounded. Deterministic
 * and independent of what the model claims about its own output length.
 */
const MAX_NOTES = 20;
const MAX_TOTAL_CHARS = 2000;
const MAX_NOTE_CHARS = 300;

function totalChars(notes: string[]): number {
  return notes.reduce((sum, note) => sum + note.length, 0);
}

export function appendMemoryNote(notes: string[], note: string): string[] {
  const trimmed = note.trim();
  if (!trimmed) return notes;
  const bounded =
    trimmed.length > MAX_NOTE_CHARS
      ? `${trimmed.slice(0, MAX_NOTE_CHARS - 1)}…`
      : trimmed;

  const next = [...notes, bounded];
  while (next.length > MAX_NOTES) next.shift();
  while (totalChars(next) > MAX_TOTAL_CHARS && next.length > 1) next.shift();
  return next;
}
