import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";

function passwordMatches(candidate: string) {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected || candidate.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

export async function POST(req: Request) {
  const { data: session } = await auth.getSession();
  const authUser = session?.user;
  if (!authUser?.id || !authUser.email) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  if (isRateLimited(`claim-owner:${authUser.id}`, { max: 5, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  if (!passwordMatches(String(body.password ?? ""))) {
    return NextResponse.json({ error: "The previous Fitlog password is incorrect" }, { status: 401 });
  }

  const [owner] = await db
    .select()
    .from(appUsers)
    .where(and(eq(appUsers.email, authUser.email.toLowerCase()), eq(appUsers.role, "owner")))
    .limit(1);
  if (!owner) {
    return NextResponse.json({ error: "This is not the owner email" }, { status: 403 });
  }
  if (owner.authUserId && owner.authUserId !== authUser.id) {
    return NextResponse.json({ error: "Owner data has already been claimed" }, { status: 409 });
  }
  if (owner.authUserId === authUser.id) return NextResponse.json({ ok: true });

  const [linked] = await db
    .update(appUsers)
    .set({
      authUserId: authUser.id,
      name: authUser.name || owner.name,
      status: "active",
      joinedAt: new Date(),
    })
    .where(and(eq(appUsers.id, owner.id), isNull(appUsers.authUserId)))
    .returning();
  if (!linked) {
    return NextResponse.json({ error: "Owner data could not be claimed" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
