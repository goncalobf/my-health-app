import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { isValidUsername } from "@/lib/username";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    status: user.status,
  });
}

export async function PATCH(req: Request) {
  const user = await requireAppUser();
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim().toLowerCase();
  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Usernames are 3-30 characters: lowercase letters, numbers, underscore." },
      { status: 400 }
    );
  }
  const [taken] = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(and(eq(appUsers.username, username), ne(appUsers.id, user.id)));
  if (taken) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }
  const [row] = await db
    .update(appUsers)
    .set({ username })
    .where(eq(appUsers.id, user.id))
    .returning();
  return NextResponse.json({ id: row.id, username: row.username });
}

// Deletes this app_users row; every personal table cascades from it (see
// schema.ts). Neon Auth's own identity/session is unaffected — the client is
// responsible for signing out immediately after this succeeds, since a
// lingering session would otherwise auto-provision a fresh blank account on
// its next authenticated request.
export async function DELETE() {
  const user = await requireAppUser();
  await db.delete(appUsers).where(eq(appUsers.id, user.id));
  return NextResponse.json({ ok: true });
}
