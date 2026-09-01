import { NextResponse } from "next/server";
import { and, eq, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appUsers, friendships } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

/** Escapes literal LIKE/ILIKE wildcards so a query containing "%" or "_"
 *  matches those characters literally instead of acting as a wildcard. */
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Suggestions while typing a friend's username or name — not a browsable
 *  directory: requires auth, a 2+ character query, matches anywhere in
 *  either field (not just a prefix, so searching a last name still finds
 *  them), and excludes people already friends or with a pending request
 *  either way. */
export async function GET(req: Request) {
  const user = await requireAppUser();
  const raw = new URL(req.url).searchParams.get("q") ?? "";
  const q = raw.trim().slice(0, 30);
  if (q.length < 2) return NextResponse.json([]);
  const pattern = `%${escapeLikePattern(q)}%`;

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
        sql`(${appUsers.username} ILIKE ${pattern} OR ${appUsers.name} ILIKE ${pattern})`,
        notInArray(appUsers.id, excludeIds),
        eq(appUsers.status, "active")
      )
    )
    .limit(8);
  return NextResponse.json(rows);
}
