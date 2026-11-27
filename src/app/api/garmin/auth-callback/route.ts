import { z } from "zod";
import { garminPrivateHeaders } from "@/lib/garmin-browser-request";
import { isGarminLegacyToken } from "@/lib/garmin-data";
import { completeGarminAuthSession, failGarminAuthSession, findLegacyGarminSession } from "@/lib/garmin-auth-session";

const handshake = z.object({
  sessionId: z.string().uuid(),
  secret: z.string().regex(/^[a-f0-9]{64}$/),
});
const callback = z.union([
  handshake.extend({ error: z.string().min(1).max(500) }),
  handshake.extend({
    token: z.custom(isGarminLegacyToken),
  }),
]);

// Only the worker's one-time secret authorizes this browser-session-free route.
export async function POST(req: Request) {
  const headers = garminPrivateHeaders;
  const parsed = callback.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid Garmin callback." }, { status: 400, headers });
  const body = parsed.data;
  try {
    const owner = await findLegacyGarminSession(body.sessionId, body.secret);
    if (owner && await ("error" in body ? failGarminAuthSession(owner) : completeGarminAuthSession(owner, body.token))) {
      return Response.json({ ok: true }, { headers });
    }
    return Response.json({ error: "Session not found, already used, or expired." }, { status: 404, headers });
  } catch {
    return Response.json({ error: "Could not save the Garmin connection." }, { status: 502, headers });
  }
}
