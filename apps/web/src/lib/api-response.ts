import type { ApiError } from "@dtlahappening/core";

/**
 * One response shape for every endpoint, so a client can write one error
 * handler instead of guessing per route.
 */

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}

export function fail(status: number, code: string, message: string) {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

export const notFound = (what: string) =>
  fail(404, "not_found", `No ${what} found.`);
