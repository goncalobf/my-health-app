import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAppUser } from "@/lib/app-user";
import { claimGarminAuth, completeGarminAuthSession, settleGarminAuth } from "@/lib/garmin-auth-session";
import { isGarminDiToken } from "@/lib/garmin-data";
import { garminDenied, garminPrivateHeaders, isGarminBrowserRequest } from "@/lib/garmin-browser-request";

export const maxDuration = 60;

const handshake = {
  sessionId: z.string().uuid(),
  secret: z.string().regex(/^[a-f0-9]{64}$/),
};
const authRequest = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    ...handshake,
    username: z.string().trim().email().max(320),
    password: z.string().min(1).max(500),
  }),
  z.object({
    action: z.literal("resume"),
    ...handshake,
    state: z.string().min(20).max(200_000),
    mfaCode: z.string().trim().regex(/^\d{4,10}$/),
  }),
]);

const serviceSuccess = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("mfa_required"),
    state: z.string().min(20).max(200_000),
    errorCode: z.enum(["MFA_INVALID", "MFA_RATE_LIMITED"]).optional(),
  }),
  z.object({
    status: z.literal("connected"),
    token: z.custom(isGarminDiToken),
  }),
]);

const path = "/api/garmin_auth";

function serviceTarget() {
  const host = process.env.VERCEL_URL;
  const previewHost = host && /^[a-z0-9.-]+\.vercel\.app$/i.test(host) ? host : null;
  const configured = process.env.GARMIN_AUTH_SERVICE_URL;
  const automationSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const directOrigin = previewHost ? `https://${previewHost}` : null;
  const origin = process.env.VERCEL_ENV === "production" && !(directOrigin && automationSecret)
    ? "https://fitlog.site" : directOrigin;
  if (!configured && !origin) throw new Error("Missing Garmin auth destination");
  const url = new URL(configured ?? `${origin}${path}`);
  const local = !process.env.VERCEL_ENV && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.pathname !== path || url.search || url.hash || url.username || url.password
    || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("Invalid Garmin auth destination");
  }
  const bypass = url.origin === directOrigin ? automationSecret : undefined;
  return { url, bypass };
}

function sign(timestamp: string, nonce: string, body: string) {
  const value = process.env.GARMIN_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) throw new Error("Missing Garmin encryption key");
  const key = createHmac("sha256", Buffer.from(value, "hex"))
    .update("fitlog-garmin-auth-signing-v2").digest();
  return createHmac("sha256", key).update(`POST\n${path}\n${timestamp}\n${nonce}\n${body}`).digest("hex");
}

function reply(data: object, status = 200) {
  return Response.json(data, { status, headers: garminPrivateHeaders });
}

function expired() {
  return reply({ code: "RESTART", error: "Garmin sign-in expired or was replaced. Start again." }, 409);
}

function serviceError(code: unknown) {
  switch (code) {
    case "AUTH_REJECTED": return reply({ error: "Garmin rejected the sign-in. Check your email and password." }, 401);
    case "RATE_LIMITED": return reply({ error: "Garmin is limiting attempts. Wait a few minutes and try again." }, 429);
    case "AUTH_TIMEOUT": return reply({ code: "RESTART", error: "Garmin took too long. Start the sign-in again." }, 504);
    case "MFA_EXPIRED": return expired();
    case "TOKEN_UNAVAILABLE": return reply({ code: "RESTART", error: "Garmin did not return a renewable session. Start again." }, 502);
    default: return reply({ code: "RESTART", error: "Garmin sign-in is temporarily unavailable. Start again." }, 502);
  }
}

export async function POST(req: Request) {
  if (!isGarminBrowserRequest(req)) return garminDenied();
  const user = await requireAppUser();
  const parsed = authRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return reply({ error: "Invalid Garmin sign-in request." }, 400);
  const body = parsed.data;
  const owner = { userId: user.id, sessionId: body.sessionId, secret: body.secret, purpose: "browser" as const };
  const serviceBody = JSON.stringify(body.action === "start"
    ? { action: body.action, sessionId: body.sessionId, username: body.username, password: body.password }
    : { action: body.action, sessionId: body.sessionId, state: body.state, mfaCode: body.mfaCode });
  let target: ReturnType<typeof serviceTarget>;
  let signature: string;
  const nonce = randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  try {
    target = serviceTarget();
    signature = sign(timestamp, nonce, serviceBody);
  } catch {
    return reply({ error: "Garmin sign-in is not configured on this deployment." }, 503);
  }
  const claim = await claimGarminAuth(user.id, body).catch(() => null);
  if (!claim) return reply({ error: "Could not start the Garmin request. Try again shortly." }, 503);
  if (claim.status === "stale") return expired();
  if (claim.status === "limited") return reply({ error: "Too many Garmin sign-in attempts." }, 429);
  try {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fitlog-Timestamp": timestamp,
        "X-Fitlog-Nonce": nonce,
        "X-Fitlog-Signature": signature,
        ...(target.bypass ? { "x-vercel-protection-bypass": target.bypass } : {}),
      },
      body: serviceBody,
      signal: AbortSignal.timeout(48_000),
      redirect: "error",
      cache: "no-store",
    });
    const data = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      const code = typeof data === "object" && data !== null && "code" in data ? data.code : null;
      if (!await settleGarminAuth(owner, claim.attemptId)) return expired();
      return serviceError(code);
    }
    const result = serviceSuccess.parse(data);
    if (result.status === "mfa_required") {
      if (!await settleGarminAuth(owner, claim.attemptId, result.state)) return expired();
      const error = result.errorCode === "MFA_INVALID"
        ? "That verification code was not accepted. Try a new code."
        : result.errorCode === "MFA_RATE_LIMITED"
          ? "Garmin is limiting attempts. Wait a few minutes and try again."
          : undefined;
      return reply({ status: result.status, state: result.state, error });
    }
    return await completeGarminAuthSession(owner, result.token, claim.attemptId)
      ? reply({ status: "connected" })
      : expired();
  } catch (error) {
    await settleGarminAuth(owner, claim.attemptId).catch(() => false);
    return serviceError(error instanceof DOMException && error.name === "TimeoutError" ? "AUTH_TIMEOUT" : null);
  }
}
