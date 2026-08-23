import Constants from "expo-constants";
import type {
  ApiEvent,
  ApiNight,
  ApiError,
  ApiSearchResults,
  EventSearchParams,
} from "@dtlahappening/core";

/**
 * Where the API lives.
 *
 * On a real device "localhost" is the PHONE, not the laptop — the single most
 * common reason a React Native app shows a network error in development.
 * Expo tells us the host it served the bundle from, which is the laptop's LAN
 * address, so we derive the API host from that instead of hardcoding an IP
 * that only works on one machine.
 *
 * Production reads EXPO_PUBLIC_API_URL, injected at build time.
 */
function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");

  const hostUri = Constants.expoConfig?.hostUri;

  if (typeof hostUri === "string" && hostUri.length > 0) {
    const host = hostUri.split(":")[0];
    return `http://${host}:3100`;
  }

  return "http://localhost:3100";
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch {
    // A phone loses signal inside a warehouse. Say something a person can act
    // on rather than surfacing a raw TypeError.
    throw new ApiRequestError(
      "Can't reach DTLAHappening. Check your connection and try again.",
      0,
      "network_error",
    );
  }

  if (!response.ok) {
    let code = "http_error";
    let message = `Something went wrong (${response.status}).`;
    try {
      const body = (await response.json()) as ApiError;
      if (body?.error) {
        code = body.error.code;
        message = body.error.message;
      }
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiRequestError(message, response.status, code);
  }

  return (await response.json()) as T;
}

export const api = {
  upcomingNight: (signal?: AbortSignal) =>
    get<ApiNight>("/api/nights/upcoming", signal),

  event: (slug: string, signal?: AbortSignal) =>
    get<ApiEvent>(`/api/events/${encodeURIComponent(slug)}`, signal),

  search: (params: EventSearchParams, signal?: AbortSignal) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.category) qs.set("category", params.category);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.freeOnly) qs.set("freeOnly", "true");
    const suffix = qs.toString() ? `?${qs}` : "";
    return get<ApiSearchResults>(`/api/events/search${suffix}`, signal);
  },
};
