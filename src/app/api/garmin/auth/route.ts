import { createHmac } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { garminAuthSessions } from "@/db/schema";
import { requireAppUser } from "@/lib/app-user";
import { completeGarminAuthSession } from "@/lib/garmin-auth-session";
import { isGarminDiToken } from "@/lib/garmin-client";
import { isRateLimited } from "@/lib/rate-limit";

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
    errorCode: z.literal("MFA_INVALID").optional(),
  }),
  z.object({
    status: z.literal("connected"),
    token: z.object({
      kind: z.literal("di"),
      accessToken: z.string().min(20),
      refreshToken: z.string().min(20),
      clientId: z.string().min(3).max(200),
    }),
  }),
]);

function serviceUrl(): string {
  const configured = process.env.GARMIN_AUTH_SERVICE_URL;
  if (configured) {
    const url = new URL(configured);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
      throw new Error("GARMIN_AUTH_SERVICE_URL must use HTTPS");
    }
    return url.toString();
  }
  const deploymentHost = process.env.VERCEL_URL;
  if (!deploymentHost || !/^[a-z0-9.-]+$/i.test(deploymentHost)) {
    throw new Error("Garmin auth service is not configured");
  }
  return `https://${deploymentHost}/api/garmin_auth`;
}

function signingKey(): Buffer {
  const value = process.env.GARMIN_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("GARMIN_ENCRYPTION_KEY is not configured");
  }
  return createHmac("sha256", Buffer.from(value, "hex"))
    .update("fitlog-garmin-auth-signing-v1")
    .digest();
}

function safeServiceError(status: number, code: unknown): { status: number; message: string } {
  if (status === 401 && code === "MFA_INVALID") {
    return { status: 401, message: "That verification code was not accepted. Try a new code." };
  }
  if (status === 401) {
    return { status: 401, message: "Garmin rejected the sign-in. Check your email and password." };
  }
  if (status === 408) {
    return { status: 408, message: "Garmin took too long to respond. Please try again." };
  }
  if (status === 429) {
    return { status: 429, message: "Garmin is limiting sign-in attempts. Wait a few minutes and try again." };
  }
  if (status === 400 && code === "MFA_EXPIRED") {
    return { status: 400, message: "That verification session expired. Start the Garmin sign-in again." };
  }
  return { status: 502, message: "Garmin sign-in is temporarily unavailable. Please try again." };
}

export async function POST(req: Request) {
  const user = await requireAppUser();
  const parsed = authRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid Garmin sign-in request." }, { status: 400 });
  }
  const body = parsed.data;
  const [session] = await db.select({ id: garminAuthSessions.id })
    .from(garminAuthSessions)
    .where(and(
      eq(garminAuthSessions.id, body.sessionId),
      eq(garminAuthSessions.userId, user.id),
      eq(garminAuthSessions.secret, body.secret),
      eq(garminAuthSessions.status, "pending"),
      gt(garminAuthSessions.expiresAt, new Date()),
    ));
  if (!session) {
    return Response.json({ error: "Garmin sign-in expired. Start again." }, { status: 404 });
  }

  const limit = body.action === "start"
    ? { key: `garmin-auth-start:${user.id}`, max: 5, windowMs: 30 * 60 * 1000 }
    : { key: `garmin-auth-mfa:${user.id}`, max: 10, windowMs: 10 * 60 * 1000 };
  if (isRateLimited(limit.key, { max: limit.max, windowMs: limit.windowMs })) {
    return Response.json(
      { error: "Too many Garmin sign-in attempts. Please wait and try again." },
      { status: 429 },
    );
  }

  const serviceBody = JSON.stringify(body.action === "start"
    ? {
        action: body.action,
        sessionId: body.sessionId,
        username: body.username,
        password: body.password,
      }
    : {
        action: body.action,
        sessionId: body.sessionId,
        state: body.state,
        mfaCode: body.mfaCode,
      });
  const timestamp = String(Math.floor(Date.now() / 1000));
  let signature: string;
  let url: string;
  try {
    signature = createHmac("sha256", signingKey())
      .update(`${timestamp}.${serviceBody}`)
      .digest("hex");
    url = serviceUrl();
  } catch {
    return Response.json(
      { error: "Garmin sign-in is not configured on this deployment." },
      { status: 503 },
    );
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fitlog-Timestamp": timestamp,
        "X-Fitlog-Signature": signature,
      },
      body: serviceBody,
      signal: AbortSignal.timeout(55_000),
      cache: "no-store",
    });
  } catch {
    return Response.json(
      { error: "Garmin sign-in could not reach the authentication service." },
      { status: 502 },
    );
  }

  const serviceData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const code = typeof serviceData === "object" && serviceData !== null && "code" in serviceData
      ? serviceData.code
      : null;
    const safe = safeServiceError(response.status, code);
    return Response.json({ error: safe.message }, { status: safe.status });
  }
  const result = serviceSuccess.safeParse(serviceData);
  if (!result.success) {
    return Response.json({ error: "Garmin returned an invalid sign-in response." }, { status: 502 });
  }
  if (result.data.status === "mfa_required") {
    return Response.json({
      status: result.data.status,
      state: result.data.state,
      ...(result.data.errorCode === "MFA_INVALID"
        ? { error: "That verification code was not accepted. Try a new code." }
        : {}),
    });
  }
  if (!isGarminDiToken(result.data.token)) {
    return Response.json({ error: "Garmin returned an invalid session." }, { status: 502 });
  }

  try {
    const saved = await completeGarminAuthSession(body.sessionId, body.secret, result.data.token);
    if (!saved) {
      return Response.json({ error: "Garmin sign-in expired. Start again." }, { status: 409 });
    }
  } catch {
    return Response.json({ error: "Could not save the Garmin connection." }, { status: 502 });
  }
  return Response.json({ status: "connected" });
}
