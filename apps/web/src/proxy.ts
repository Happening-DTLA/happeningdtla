import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * CORS for /api/*.
 *
 * Native apps ignore CORS entirely, so the shipped iOS and Android clients
 * never need this. It exists for browser clients: the Expo web build during
 * development, and any future web surface served from another origin.
 *
 * We reflect a specific allowed origin rather than sending `*`, so that adding
 * cookie-authenticated endpoints later doesn't require rewriting this — `*` and
 * credentials are mutually exclusive.
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

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    // Answer the preflight without touching the route handler.
    const preflight = new NextResponse(null, { status: 204 });
    return isAllowedOrigin(origin) ? withCors(preflight, origin) : preflight;
  }

  const response = NextResponse.next();
  return isAllowedOrigin(origin) ? withCors(response, origin) : response;
}

export const config = {
  matcher: "/api/:path*",
};
