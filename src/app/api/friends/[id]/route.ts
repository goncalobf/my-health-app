import { NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { friendships } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

/** Accept or decline an incoming pending request. Only the recipient may act. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const friendshipId = Number(id);
  const body = await req.json().catch(() => ({}));
  const action = body.action === "accept" || body.action === "decline" ? body.action : null;
  if (!action) return NextResponse.json({ error: "action must be accept or decline" }, { status: 400 });

  const [row] = await db
    .update(friendships)
    .set({ status: action === "accept" ? "accepted" : "declined", respondedAt: new Date() })
    .where(
      and(
        eq(friendships.id, friendshipId),
        eq(friendships.recipientId, user.id),
        eq(friendships.status, "pending")
      )
    )
    .returning();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

/** Cancel an outgoing request or unfriend an accepted one — either party may act. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;
  const friendshipId = Number(id);
  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.id, friendshipId),
        or(eq(friendships.requesterId, user.id), eq(friendships.recipientId, user.id))
      )
    );
  return NextResponse.json({ ok: true });
}
