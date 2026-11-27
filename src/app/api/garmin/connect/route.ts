import { eq } from "drizzle-orm";
import { db } from "@/db";
import { garminConnections } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { beginGarminAuth, completeGarminAuthSession, failGarminAuthSession } from "@/lib/garmin-auth-session";
import { garminDenied, garminPrivateHeaders, isGarminBrowserRequest } from "@/lib/garmin-browser-request";
import { createGarminClient, GarminAuthenticationFailed, isGarminToken } from "@/lib/garmin-client";
import { disconnectGarmin } from "@/lib/garmin-operations";

export const maxDuration = 60;

function reply(data: object, status = 200) {
  return Response.json(data, { status, headers: garminPrivateHeaders });
}

export async function GET() {
  const user = await requireAppUser();
  const [row] = await db
    .select({ connectedAt: garminConnections.connectedAt, lastSyncedAt: garminConnections.lastSyncedAt })
    .from(garminConnections)
    .where(eq(garminConnections.userId, user.id));
  return reply({ connected: Boolean(row), connectedAt: row?.connectedAt ?? null, lastSyncedAt: row?.lastSyncedAt ?? null });
}

class ManualConnectionSuperseded extends Error {}

export async function POST(req: Request) {
  if (!isGarminBrowserRequest(req)) return garminDenied();
  const user = await requireAppUser();
  const body = await req.json().catch(() => null);
  const raw = body?.token;
  if (typeof raw !== "string" || raw.length > 50_000) return reply({ error: "A Garmin token is required." }, 400);
  let token: unknown;
  try {
    token = JSON.parse(raw);
  } catch {
    return reply({ error: "Paste the full JSON output from the Garmin sign-in script." }, 400);
  }
  if (!isGarminToken(token)) return reply({ error: "Invalid Garmin token." }, 400);
  const session = await beginGarminAuth(user.id, "manual").catch(() => undefined);
  if (session === undefined) return reply({ error: "Could not start the Garmin sign-in. Try again shortly." }, 503);
  if (!session) return reply({ error: "Too many Garmin sign-in attempts." }, 429);
  const owner = { userId: user.id, sessionId: session.id, secret: session.secret, purpose: "manual" as const };
  let saved = false;
  const garmin = createGarminClient(token, {
    signal: AbortSignal.timeout(28_000),
    onRefresh: async (renewed) => {
      if (!await completeGarminAuthSession(owner, renewed)) throw new ManualConnectionSuperseded();
      saved = true;
    },
  });
  const superseded = () => reply({ error: "This Garmin sign-in was replaced. Start again." }, 409);
  try {
    await garmin.activities(1);
  } catch (error) {
    if (error instanceof Error && error.cause instanceof ManualConnectionSuperseded) return superseded();
    if (!saved) {
      await failGarminAuthSession(owner).catch(() => false);
      return error instanceof GarminAuthenticationFailed
        ? reply({ error: "Garmin rejected the token. Get a fresh token and try again." }, 401)
        : reply({ error: "Could not validate the Garmin token. Try again shortly." }, 502);
    }
    // A successful provider exchange already proved and saved the new credentials.
  }
  if (!saved) {
    try {
      if (!await completeGarminAuthSession(owner, garmin.token)) return superseded();
    } catch {
      return reply({ error: "Could not save the Garmin connection. Try again shortly." }, 503);
    }
  }
  return reply({ connected: true });
}

export async function DELETE(req: Request) {
  if (!isGarminBrowserRequest(req)) return garminDenied();
  const user = await requireAppUser();
  await disconnectGarmin(user.id);
  return new Response(null, { status: 204, headers: garminPrivateHeaders });
}
