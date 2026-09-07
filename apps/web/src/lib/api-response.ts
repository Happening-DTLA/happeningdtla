import type { ApiError } from "@dtlahappening/core";
import * as Sentry from "@sentry/nextjs";

/**
 * One response shape for every endpoint, so a client can write one error
 * handler instead of guessing per route.
 */

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}

export function fail(status: number, code: string, message: string, report = true) {
  if (report && status >= 500) {
    Sentry.captureMessage(`API response: ${code}`, {
      level: "error",
      tags: { api_error_code: code, http_status: String(status) },
    });
  }
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}

export const notFound = (what: string) =>
  fail(404, "not_found", `No ${what} found.`);

/**
 * Wraps a route handler so an unexpected throw becomes JSON instead of an
 * empty 500.
 *
 * This exists because of a real failure: under concurrent scans the database
 * token lookup threw before the handler's own try/catch could run, and the
 * door received a 500 with no body. A scanner that gets unparseable output
 * cannot tell "let them in" from "don't", and the person on the door has to
 * decide with nothing to go on.
 */
export function withErrorBoundary<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
  context: string,
) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      console.error(`[${context}] unhandled error`, err);
      Sentry.captureException(err, {
        tags: { api_context: context },
      });
      return fail(503, "temporarily_unavailable", "Something went wrong. Please try again.", false);
    }
  };
}
