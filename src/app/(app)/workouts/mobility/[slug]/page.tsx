import { notFound } from "next/navigation";
import MobilitySession from "@/components/MobilitySession";
import PageHeader from "@/components/PageHeader";
import { getMobilityRoutine } from "@/lib/mobility";

export default async function MobilityRoutinePage({ params }: { params: Promise<{ slug: string }> }) {
  const routine = getMobilityRoutine((await params).slug);
  if (!routine) notFound();
  return (
    <>
      <PageHeader title="Mobility routine" back="/workouts/mobility" />
      <MobilitySession key={routine.id} routine={routine} />
    </>
  );
}
