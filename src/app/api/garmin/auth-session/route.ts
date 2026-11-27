import { z } from "zod";
import { requireAppUser } from "@/lib/app-user";
import { beginGarminAuth } from "@/lib/garmin-auth-session";
import { isGarminBrowserRequest, garminDenied, garminPrivateHeaders } from "@/lib/garmin-browser-request";

export async function POST(req: Request) {
  if (!isGarminBrowserRequest(req)) return garminDenied();
  const user = await requireAppUser();
  const body = await req.text();
  const purpose = z.enum(["browser", "legacy"]).safeParse(
    body === "" ? "legacy" : await new Response(body).json().then((data) => data?.purpose, () => null),
  );
  const headers = garminPrivateHeaders;
  if (!purpose.success) return Response.json({ error: "Invalid Garmin sign-in mode." }, { status: 400, headers });
  try {
    const session = await beginGarminAuth(user.id, purpose.data);
    return session
      ? Response.json(session, { headers })
      : Response.json({ error: "Too many Garmin sign-in attempts." }, { status: 429, headers });
  } catch {
    return Response.json({ error: "Could not start the Garmin sign-in. Try again shortly." }, { status: 503, headers });
  }
}
