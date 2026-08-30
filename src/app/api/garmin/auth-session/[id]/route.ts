import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { garminAuthSessions } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;

  const [session] = await db
    .select({
      status: garminAuthSessions.status,
      errorMessage: garminAuthSessions.errorMessage,
      expiresAt: garminAuthSessions.expiresAt,
    })
    .from(garminAuthSessions)
    .where(and(eq(garminAuthSessions.id, id), eq(garminAuthSessions.userId, user.id)));

  if (!session) return NextResponse.json({ status: "not_found" }, { status: 404 });
  if (session.expiresAt < new Date()) return NextResponse.json({ status: "expired" });

  return NextResponse.json({
    status: session.status,
    error: session.errorMessage ?? null,
  });
}
