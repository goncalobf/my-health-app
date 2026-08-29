/**
 * Turns a user's own training numbers into short, hard statements. Pure and
 * deterministic so the wording can be unit tested rather than trusted.
 */

export interface MotivationInput {
  /** Whole days since the last finished workout, or null if never trained. */
  daysSinceLastWorkout: number | null;
  workoutsThisWeek: number;
  workoutsPreviousWeek: number;
  volumeThisWeekKg: number;
  volumePreviousWeekKg: number;
  /** The lift with the biggest working-weight gain, if any. */
  bestLift: { name: string; gainKg: number } | null;
  totalWorkouts: number;
}

export type MotivationFactKind =
  | "absence"
  | "consistency"
  | "volume"
  | "lift"
  | "milestone";

export interface MotivationFact {
  kind: MotivationFactKind;
  text: string;
  /** Higher wins when only one fact can be shown. */
  weight: number;
}

/** Three clear days without training is treated as slipping. */
export const SLIPPING_AFTER_DAYS = 3;

export function isSlipping(input: MotivationInput): boolean {
  return (
    input.daysSinceLastWorkout !== null &&
    input.daysSinceLastWorkout >= SLIPPING_AFTER_DAYS
  );
}

function round(value: number, dp = 0) {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

/**
 * Facts worth showing, strongest first. An empty result means there is not
 * enough history to say anything true, and the caller should show only a line.
 */
export function buildMotivationFacts(input: MotivationInput): MotivationFact[] {
  const facts: MotivationFact[] = [];

  if (input.daysSinceLastWorkout !== null && input.daysSinceLastWorkout >= SLIPPING_AFTER_DAYS) {
    facts.push({
      kind: "absence",
      text: `${input.daysSinceLastWorkout} days. Nothing logged.`,
      weight: 100 + input.daysSinceLastWorkout,
    });
  }

  if (input.workoutsThisWeek >= 3) {
    facts.push({
      kind: "consistency",
      text: `${input.workoutsThisWeek} sessions in 7 days.`,
      weight: 60 + input.workoutsThisWeek,
    });
  }

  if (input.volumePreviousWeekKg > 0 && input.volumeThisWeekKg > 0) {
    const change =
      ((input.volumeThisWeekKg - input.volumePreviousWeekKg) /
        input.volumePreviousWeekKg) *
      100;
    if (change >= 5) {
      facts.push({
        kind: "volume",
        text: `${round(change)}% more volume than last week.`,
        weight: 70,
      });
    } else if (change <= -15) {
      facts.push({
        kind: "volume",
        text: `Volume down ${round(Math.abs(change))}% on last week.`,
        weight: 75,
      });
    }
  }

  if (input.bestLift && input.bestLift.gainKg > 0) {
    facts.push({
      kind: "lift",
      text: `${input.bestLift.name} is up ${round(input.bestLift.gainKg, 1)}kg.`,
      weight: 80,
    });
  }

  if (input.totalWorkouts > 0 && input.totalWorkouts % 10 === 0) {
    facts.push({
      kind: "milestone",
      text: `${input.totalWorkouts} workouts done.`,
      weight: 90,
    });
  }

  return facts.sort((a, b) => b.weight - a.weight);
}

export function topMotivationFact(input: MotivationInput): MotivationFact | null {
  return buildMotivationFacts(input)[0] ?? null;
}
