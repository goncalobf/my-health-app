import { auth } from "@/lib/auth";

type Handlers = ReturnType<typeof auth.handler>;
type Context = { params: Promise<{ path: string[] }> };

let handlers: Handlers | null = null;

// Resolved per request so a build without Neon Auth configuration still
// collects this route's page data instead of throwing.
function routes(): Handlers {
  handlers ??= auth.handler();
  return handlers;
}

export const GET = (request: Request, context: Context) =>
  routes().GET(request, context);
export const POST = (request: Request, context: Context) =>
  routes().POST(request, context);
export const PUT = (request: Request, context: Context) =>
  routes().PUT(request, context);
export const DELETE = (request: Request, context: Context) =>
  routes().DELETE(request, context);
export const PATCH = (request: Request, context: Context) =>
  routes().PATCH(request, context);
