import "server-only";
import { cache } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  appUsers,
  settings,
  trainingPlanState,
  workoutSchedule,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { todayISO } from "@/lib/utils";

async function initializeUserData(userId: number) {
  await db
    .insert(settings)
    .values({ userId })
    .onConflictDoNothing({ target: settings.userId });
  await db
    .insert(trainingPlanState)
    .values({ userId, planName: "My training plan", blockStartedOn: todayISO() })
    .onConflictDoNothing({ target: trainingPlanState.userId });
  await db
    .insert(workoutSchedule)
    .values(
      Array.from({ length: 7 }, (_, index) => ({
        userId,
        dayOfWeek: index + 1,
        routineId: null,
      }))
    )
    .onConflictDoNothing();
}

export const getAppUser = cache(async function getAppUser() {
  const { data: session } = await auth.getSession();
  const authUser = session?.user;
  if (!authUser?.id || !authUser.email) return null;

  const email = authUser.email.trim().toLowerCase();
  let [appUser] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.authUserId, authUser.id))
    .limit(1);

  if (!appUser) {
    [appUser] = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.email, email))
      .limit(1);
  }

  if (!appUser || appUser.status === "revoked") return null;
  if (appUser.authUserId && appUser.authUserId !== authUser.id) return null;
  // The legacy owner must prove knowledge of the old shared password through
  // /api/claim-owner before historical health data can be linked.
  if (appUser.role === "owner" && !appUser.authUserId) return null;

  if (!appUser.authUserId) {
    const [linked] = await db
      .update(appUsers)
      .set({
        authUserId: authUser.id,
        name: authUser.name || appUser.name,
        status: "active",
        joinedAt: new Date(),
      })
      .where(and(eq(appUsers.id, appUser.id), isNull(appUsers.authUserId)))
      .returning();
    if (!linked) return null;
    appUser = linked;
    await initializeUserData(appUser.id);
  }

  return appUser;
});

export async function requireAppUser() {
  const user = await getAppUser();
  if (!user) redirect("/access-pending");
  return user;
}
