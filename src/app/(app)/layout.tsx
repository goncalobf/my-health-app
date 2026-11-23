import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import AppShell from "@/components/AppShell";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

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
    .select({ onboardedAt: settings.onboardedAt })
    .from(settings)
    .where(eq(settings.userId, user.id));
  if (!row?.onboardedAt) redirect("/onboarding");

  return <AppShell>{children}</AppShell>;
}
