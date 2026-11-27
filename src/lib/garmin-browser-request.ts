import "server-only";
import { isLocalMode } from "./local-mode";

export const garminPrivateHeaders = { "Cache-Control": "no-store" };

export function isGarminBrowserRequest(req: Request) {
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (!origin) return !fetchSite || fetchSite === "same-origin";
  if (fetchSite === "cross-site") return false;
  const trusted = ["https://fitlog.site", "https://www.fitlog.site"];
  if (process.env.VERCEL_URL && /^[a-z0-9.-]+\.vercel\.app$/i.test(process.env.VERCEL_URL)) {
    trusted.push(`https://${process.env.VERCEL_URL}`);
  }
  if (isLocalMode() && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return trusted.includes(origin);
}

export function garminDenied() {
  return Response.json({ error: "Invalid request origin." }, { status: 403, headers: garminPrivateHeaders });
}
