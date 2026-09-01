import { NextResponse } from "next/server";
import { and, eq, ilike, notInArray, or } from "drizzle-orm";
import { db } from "@/db";
import { appUsers, friendships } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

/** Prefix-only suggestions while typing a username to add — not a browsable
 *  directory: requires auth, a 2+ character prefix, and excludes people
 *  already friends or with a pending request either way. */
export async function GET(req: Request) {
  const user = await requireAppUser();
  const raw = new URL(req.url).searchParams.get("q") ?? "";
  const q = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
  if (q.length < 2) return NextResponse.json([]);

  const related = await db
    .select({ requesterId: friendships.requesterId, recipientId: friendships.recipientId })
    .from(friendships)
    .where(
      and(
        or(eq(friendships.requesterId, user.id), eq(friendships.recipientId, user.id)),
        or(eq(friendships.status, "pending"), eq(friendships.status, "accepted"))
      )
    );
  const excludeIds = [
    user.id,
    ...related.map((r) => (r.requesterId === user.id ? r.recipientId : r.requesterId)),
  ];

  const rows = await db
    .select({ id: appUsers.id, username: appUsers.username, name: appUsers.name })
    .from(appUsers)
    .where(
      and(
        ilike(appUsers.username, `${q}%`),
        notInArray(appUsers.id, excludeIds),
        eq(appUsers.status, "active")
      )
    )
    .limit(8);
  return NextResponse.json(rows);
}
