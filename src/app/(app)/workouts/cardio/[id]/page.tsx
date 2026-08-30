"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import EasyRunRecording from "@/components/cardio/EasyRunRecording";
import IntervalRunRecording from "@/components/cardio/IntervalRunRecording";
import CyclingRecording from "@/components/cardio/CyclingRecording";
import HyroxRecording from "@/components/cardio/HyroxRecording";
import type { ActivitySession } from "@/db/schema";

export default function CardioSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState<ActivitySession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<ActivitySession>(`/api/cardio-sessions/${id}`)
      .then(setSession)
      .catch(() => router.replace("/workouts"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center text-muted text-sm">
        Loading…
      </div>
    );
  }
  if (!session) return null;

  const onDone = () => router.replace(`/workouts/cardio/${id}/summary`);

  if (session.type === "run_easy") return <EasyRunRecording session={session} onDone={onDone} />;
  if (session.type === "run_interval") return <IntervalRunRecording session={session} onDone={onDone} />;
  if (session.type === "indoor_cycling" || session.type === "outdoor_cycling")
    return <CyclingRecording session={session} onDone={onDone} />;
  if (session.type === "hyrox") return <HyroxRecording session={session} onDone={onDone} />;

  return <p className="text-muted">Unknown activity type.</p>;
}
