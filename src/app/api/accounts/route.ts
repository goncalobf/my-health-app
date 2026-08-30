import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

async function requireOwner() {
  const user = await requireAppUser();
  return user.role === "owner" ? user : null;
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const rows = await db
    .select({
      id: appUsers.id,
      email: appUsers.email,
      name: appUsers.name,
      role: appUsers.role,
      status: appUsers.status,
      joinedAt: appUsers.joinedAt,
    })
    .from(appUsers)
    .orderBy(asc(appUsers.id));
  return NextResponse.json(rows);
}

export async function PATCH(req: Request) {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  }
  if (body.status !== "active" && body.status !== "revoked") {
    return NextResponse.json({ error: "Invalid account status" }, { status: 400 });
  }

  const [target] = await db.select().from(appUsers).where(eq(appUsers.id, id));
  if (!target || target.role === "owner") {
    return NextResponse.json({ error: "Account cannot be changed" }, { status: 400 });
  }

  const [row] = await db
    .update(appUsers)
    .set({ status: body.status })
    .where(eq(appUsers.id, id))
    .returning();
  return NextResponse.json(row);
}
