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
import { isLocalMode, LOCAL_USER_EMAIL, LOCAL_USER_NAME } from "@/lib/local-mode";
import { todayISO } from "@/lib/utils";
import { deriveUsernameBase } from "@/lib/username";

/** Appends a numeric suffix until the candidate is free. Every new account
 *  gets a username immediately so friend requests always have one to search. */
async function resolveUniqueUsername(name: string | null, email: string) {
  const base = deriveUsernameBase(name, email);
  let candidate = base;
  for (let suffix = 2; ; suffix++) {
    const [taken] = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(eq(appUsers.username, candidate))
      .limit(1);
    if (!taken) return candidate;
    candidate = `${base.slice(0, 24 - String(suffix).length - 1)}_${suffix}`;
  }
}

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
  // Local mode has no Neon Auth at all: resolve a fixed local account so the
  // app can be opened without a login page. Guarded to non-deployed builds.
  if (isLocalMode()) {
    const [existing] = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.email, LOCAL_USER_EMAIL))
      .limit(1);
    if (existing) return existing;
    const [created] = await db
      .insert(appUsers)
      .values({
        email: LOCAL_USER_EMAIL,
        name: LOCAL_USER_NAME,
        username: await resolveUniqueUsername(LOCAL_USER_NAME, LOCAL_USER_EMAIL),
        role: "owner",
        status: "active",
        authUserId: "local-dev-user",
        joinedAt: new Date(),
      })
      .returning();
    await initializeUserData(created.id);
    return created;
  }
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

  // Registration is open. Neon Auth proves the identity; the application row
  // is created here on first access so every account still gets an isolated
  // numeric user ID for its private Fitlog data.
  if (!appUser) {
    const [created] = await db
      .insert(appUsers)
      .values({
        authUserId: authUser.id,
        email,
        name: authUser.name || null,
        username: await resolveUniqueUsername(authUser.name ?? null, email),
        role: "member",
        status: "active",
      })
      .onConflictDoNothing({ target: appUsers.email })
      .returning();

    if (created) {
      appUser = created;
    } else {
      // A simultaneous first request may have inserted the row after our first
      // lookup. Resolve that winner and apply the same identity checks below.
      [appUser] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.email, email))
        .limit(1);
    }
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
      })
      .where(and(eq(appUsers.id, appUser.id), isNull(appUsers.authUserId)))
      .returning();
    if (!linked) return null;
    appUser = linked;
  }

  // joinedAt doubles as the provisioning-complete marker. If initialization
  // was interrupted, the next request safely retries these idempotent inserts.
  if (!appUser.joinedAt) {
    await initializeUserData(appUser.id);
    const [initialized] = await db
      .update(appUsers)
      .set({ status: "active", joinedAt: new Date() })
      .where(eq(appUsers.id, appUser.id))
      .returning();
    if (!initialized) return null;
    appUser = initialized;
  }

  return appUser;
});

export async function requireAppUser() {
  const user = await getAppUser();
  if (!user) redirect("/access-pending");
  return user;
}
