import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers, friendships } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { findExistingFriendship, listFriendships } from "@/lib/friends-data";
import { isValidUsername } from "@/lib/username";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json(await listFriendships(user.id));
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  if (!isValidUsername(username)) {
    return NextResponse.json({ error: "Enter a valid username." }, { status: 400 });
  }

  const [recipient] = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(eq(appUsers.username, username));
  if (!recipient) {
    return NextResponse.json({ error: "No account with that username." }, { status: 404 });
  }
  if (recipient.id === user.id) {
    return NextResponse.json({ error: "You can't friend yourself." }, { status: 400 });
  }

  const existing = await findExistingFriendship(user.id, recipient.id);
  if (existing) {
    if (existing.status === "pending" || existing.status === "accepted") {
      return NextResponse.json(
        { error: existing.status === "accepted" ? "Already friends." : "A request is already pending." },
        { status: 409 }
      );
    }
    // A prior request in this same direction was declined. Reset it in place
    // rather than inserting — (requester, recipient) is uniquely indexed.
    if (existing.requesterId === user.id) {
      const [row] = await db
        .update(friendships)
        .set({ status: "pending", createdAt: new Date(), respondedAt: null })
        .where(eq(friendships.id, existing.id))
        .returning();
      return NextResponse.json(row, { status: 201 });
    }
  }

  const [row] = await db
    .insert(friendships)
    .values({ requesterId: user.id, recipientId: recipient.id, status: "pending" })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
