import { z } from "zod";
import { completeGarminAuthSession, failGarminAuthSession } from "@/lib/garmin-auth-session";

const handshake = z.object({
  sessionId: z.string().uuid(),
  secret: z.string().regex(/^[a-f0-9]{64}$/),
});
const callback = z.union([
  handshake.extend({ error: z.string().min(1).max(500) }),
  handshake.extend({
    token: z.object({
      oauth1: z.record(z.unknown()),
      oauth2: z.record(z.unknown()),
    }),
  }),
]);

// Only the worker's one-time secret authorizes this browser-session-free route.
export async function POST(req: Request) {
  const parsed = callback.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid Garmin callback." }, { status: 400 });
  const body = parsed.data;
  try {
    if ("error" in body) {
      if (await failGarminAuthSession(body.sessionId, body.secret)) {
        return Response.json({ ok: true });
      }
    } else {
      if (await completeGarminAuthSession(body.sessionId, body.secret, body.token)) {
        return Response.json({ ok: true });
      }
    }
    return Response.json({ error: "Session not found, already used, or expired." }, { status: 404 });
  } catch {
    return Response.json({ error: "Could not save the Garmin connection." }, { status: 502 });
  }
}
