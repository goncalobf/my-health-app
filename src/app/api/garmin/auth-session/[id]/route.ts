import { cancelGarminAuth } from "@/lib/garmin-auth-session";
import { garminDenied, garminPrivateHeaders, isGarminBrowserRequest } from "@/lib/garmin-browser-request";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { garminAuthSessions } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";

const sessionIdPattern = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAppUser();
  const { id } = await params;

  const headers = garminPrivateHeaders;
  if (!sessionIdPattern.test(id)) return Response.json({ status: "not_found" }, { status: 404, headers });
  const [session] = await db
    .select({
      status: garminAuthSessions.status,
      purpose: garminAuthSessions.purpose,
      errorMessage: garminAuthSessions.errorMessage,
      expiresAt: garminAuthSessions.expiresAt,
    })
    .from(garminAuthSessions)
    .where(and(eq(garminAuthSessions.id, id), eq(garminAuthSessions.userId, user.id)));

  if (!session) return Response.json({ status: "not_found" }, { status: 404, headers });
  if (session.purpose === "unclassified" || session.expiresAt <= new Date()) return Response.json({ status: "expired" }, { headers });

  return Response.json({
    status: session.status,
    error: session.errorMessage ?? null,
  }, { headers });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isGarminBrowserRequest(req)) return garminDenied();
  const user = await requireAppUser();
  const { id } = await params;
  if (sessionIdPattern.test(id)) await cancelGarminAuth(user.id, id);
  return new Response(null, { status: 204, headers: garminPrivateHeaders });
}
