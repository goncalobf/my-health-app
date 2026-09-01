import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function GET() {
  const user = await requireAppUser();
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  });
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
