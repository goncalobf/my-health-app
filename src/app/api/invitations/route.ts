import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function requireOwner() {
  const user = await requireAppUser();
  return user.role === "owner" ? user : null;
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  const rows = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      name: appUsers.name,
      role: appUsers.role,
      status: appUsers.status,
      invitedAt: appUsers.invitedAt,
      joinedAt: appUsers.joinedAt,
    })
    .from(appUsers)
    .orderBy(asc(appUsers.id));
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!validEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const [existing] = await db.select().from(appUsers).where(eq(appUsers.email, email));
  if (existing) {
    if (existing.role === "owner") return NextResponse.json(existing);
    const [row] = await db
      .update(appUsers)
      .set({ status: existing.authUserId ? "active" : "invited", invitedAt: new Date() })
      .where(eq(appUsers.id, existing.id))
      .returning();
    return NextResponse.json(row);
  }

  const [row] = await db
    .insert(appUsers)
    .values({ email, role: "member", status: "invited" })
    .returning();
  return NextResponse.json(row, { status: 201 });
}

export async function PATCH(req: Request) {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const status = body.status === "revoked" ? "revoked" : "invited";
  const [target] = await db.select().from(appUsers).where(eq(appUsers.id, id));
  if (!target || target.role === "owner") {
    return NextResponse.json({ error: "Account cannot be changed" }, { status: 400 });
  }
  const nextStatus = status === "invited" && target.authUserId ? "active" : status;
  const [row] = await db.update(appUsers).set({ status: nextStatus }).where(eq(appUsers.id, id)).returning();
  return NextResponse.json(row);
}
