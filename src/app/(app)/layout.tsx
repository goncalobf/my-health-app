import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import { db } from "@/db";
import { garminConnections, settings } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import GarminLoginSync from "@/components/GarminLoginSync";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAppUser();

  // A new account sets its goal and body profile before reaching the app, so
  // the calorie, macro and progression maths always has real inputs.
  const [row] = await db
    .select({
      onboardedAt: settings.onboardedAt,
      garminUserId: garminConnections.userId,
    })
    .from(settings)
    .leftJoin(garminConnections, eq(garminConnections.userId, settings.userId))
    .where(eq(settings.userId, user.id));
  if (!row?.onboardedAt) redirect("/onboarding");

  return (
    <GarminLoginSync key={user.id} enabled={row.garminUserId !== null}>
      <AppShell>{children}</AppShell>
    </GarminLoginSync>
  );
}
