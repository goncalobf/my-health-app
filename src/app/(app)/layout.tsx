import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import BottomNav from "@/components/BottomNav";
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

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-lg px-3 pb-28 pt-4 min-[360px]:px-4 safe-top">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
