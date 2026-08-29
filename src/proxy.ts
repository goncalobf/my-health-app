import { NextResponse, type NextRequest } from "next/server";
import { auth, isAuthConfigured } from "@/lib/auth";
import { isLocalMode } from "@/lib/local-mode";

let handler: ReturnType<typeof auth.middleware> | null = null;

export default function proxy(request: NextRequest) {
  // Local mode runs without Neon Auth, so there is no session to check and no
  // login page to redirect to.
  if (isLocalMode()) return NextResponse.next();

  // A deployment without Neon Auth configuration, such as a preview build with
  // no secrets, has no way to identify anyone. Refuse every request rather than
  // letting one through unauthenticated.
  if (!isAuthConfigured()) {
    return new NextResponse(
      "This deployment has no Neon Auth configuration, so Fitlog cannot sign anyone in or serve any data.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }
  handler ??= auth.middleware({ loginUrl: "/auth/sign-in" });
  return handler(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|sw.js).*)",
  ],
};
