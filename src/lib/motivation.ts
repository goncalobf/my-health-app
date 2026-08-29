/**
 * Motivation content. Everything here is deterministic: the same seed always
 * yields the same line and image, so a server render and the client agree and
 * the dashboard does not reshuffle on every re-render.
 */

export type MotivationContext =
  | "dashboard"
  | "hype"
  | "workout"
  | "summary"
  | "slipping";

const LINES: Record<MotivationContext, string[]> = {
  dashboard: [
    "The work does not care how you feel.",
    "Discipline.",
    "Someone else is training right now.",
    "Comfort built nothing.",
    "Earn it today.",
    "Talk less. Lift more.",
    "You either did it or you did not.",
    "Show up before you feel like it.",
  ],
  hype: [
    "Nothing gets easier. You get harder.",
    "Leave nothing in the tank.",
    "Prove it again.",
    "The weight does not negotiate.",
    "Make today expensive.",
    "Nobody is coming to lift it for you.",
    "Go and take it.",
    "Start heavy. Finish heavier.",
  ],
  workout: [
    "One more.",
    "Do not count. Make it count.",
    "Breathe. Go again.",
    "This is the part that matters.",
    "Finish the set.",
    "You have more than this.",
    "No shortcuts.",
    "Everyone stops here. Do not.",
  ],
  summary: [
    "Banked. Now do it again.",
    "That is one more they did not do.",
    "Progress is boring. Keep going.",
    "Good. Not enough. Tomorrow.",
    "You showed up. That is the whole trick.",
    "Nothing was given. Go again.",
  ],
  slipping: [
    "Excuses do not lift.",
    "Motivation left. Go without it.",
    "Stop negotiating. Go.",
    "You already know what to do.",
    "The streak is dead. Start another.",
    "Rest was yesterday.",
  ],
};

export const MOTIVATION_IMAGES = [
  "gym-floor",
  "heavy-bag",
  "ringwork",
  "the-grind",
  "overhead",
  "before-dawn",
] as const;

export type MotivationImage = (typeof MOTIVATION_IMAGES)[number];

/** Small stable string hash, so the same seed maps to the same index anywhere. */
export function seedIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % length;
}

export function pickLine(context: MotivationContext, seed: string): string {
  const lines = LINES[context];
  return lines[seedIndex(`${context}:${seed}`, lines.length)];
}

export function pickImage(seed: string): MotivationImage {
  return MOTIVATION_IMAGES[seedIndex(`image:${seed}`, MOTIVATION_IMAGES.length)];
}

export function imagePath(image: MotivationImage): string {
  return `/motivation/${image}.jpg`;
}
