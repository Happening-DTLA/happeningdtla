import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next 16 calls this "proxy"; it is what earlier versions called middleware.
 *
 * Two jobs share it, which is why they are composed rather than living in
 * separate files — Next allows only one.
 *
 *  1. Clerk. Must run broadly, because `auth()` in a server component only
 *     works on requests this has seen.
 *  2. CORS for /api/*. Native apps ignore CORS entirely, so this exists for
 *     browser clients: the Expo web build in development, and any future web
 *     surface on another origin.
 */

const CONFIGURED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (CONFIGURED_ORIGINS.includes(origin)) return true;

  // In development the Expo bundler picks its own port and the LAN address
  // varies by machine, so pinning an exact origin would break for the other
  // developer. Never widened to production.
  if (process.env.NODE_ENV === "development") {
    return /^https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin);
  }
  return false;
}

function withCors(response: NextResponse, origin: string) {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY?.trim() && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim(),
);

function handleCors(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    const preflight = new NextResponse(null, { status: 204 });
    return isAllowedOrigin(origin) ? withCors(preflight, origin) : preflight;
  }
  const response = NextResponse.next();
  return isAllowedOrigin(origin) ? withCors(response, origin) : response;
}

/**
 * Clerk runs here ONLY to make `auth()` available downstream. It deliberately
 * does not gate anything.
 *
 * Route-matcher protection in middleware is deprecated, and Clerk's reasoning
 * is a security argument rather than a style one: path matching can diverge
 * from how Next actually routes a request, leaving a protected resource
 * reachable. Every page and API route that touches venue data already runs its
 * own check — getOrganizerContext or requireOrganizer — so the guard lives
 * next to the data it guards.
 */
const withClerk = clerkMiddleware(async (_auth, request) => handleCors(request) ?? undefined);

/**
 * Without Clerk keys the whole app still runs — the dashboard falls back to a
 * clearly-labelled development mode. Invoking clerkMiddleware unconfigured
 * would throw on every request instead.
 */
export default function proxy(request: NextRequest, event: unknown) {
  if (!clerkConfigured) return handleCors(request) ?? NextResponse.next();
  return (withClerk as unknown as (r: NextRequest, e: unknown) => Response)(request, event);
}

export const config = {
  matcher: [
    // Everything except Next internals and static files, so `auth()` is
    // available in server components.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/api/:path*",
  ],
};
