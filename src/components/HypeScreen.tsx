"use client";

import { ArrowRight } from "lucide-react";
import MotivationCard from "@/components/MotivationCard";
import { pickImage, pickLine } from "@/lib/motivation";

/**
 * The moment before the first set. Deliberately theatrical, and always one tap
 * from being out of the way.
 */
export default function HypeScreen({
  seed,
  workoutName,
  totalSets,
  exerciseCount,
  onStart,
}: {
  seed: string;
  workoutName: string;
  totalSets: number;
  exerciseCount: number;
  onStart: () => void;
}) {
  const plan = [
    exerciseCount > 0 ? `${exerciseCount} exercises` : null,
    totalSets > 0 ? `${totalSets} sets` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <MotivationCard
        variant="full"
        className="h-full"
        image={pickImage(seed)}
        line={pickLine("hype", seed)}
        eyebrow="Today"
        priority
      >
        <div className="mt-1 min-w-0 safe-bottom">
          <p className="truncate text-base font-semibold text-text">
            {workoutName}
          </p>
          {plan && <p className="text-sm text-muted tabular-nums">{plan}</p>}
          <button
            onClick={onStart}
            className="btn-primary mt-4 w-full py-3.5 text-base"
          >
            Let&apos;s go <ArrowRight size={19} />
          </button>
        </div>
      </MotivationCard>
    </div>
  );
}
