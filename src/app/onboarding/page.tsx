import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import OnboardingFlow from "./OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireAppUser();
  const [row] = await db
    .select({ onboardedAt: settings.onboardedAt })
    .from(settings)
    .where(eq(settings.userId, user.id));

  // Onboarding runs once. Anyone already set up goes straight to the app.
  if (row?.onboardedAt) redirect("/");

  return <OnboardingFlow name={user.name} />;
}
