import * as Sentry from "@sentry/react-native";

/**
 * Report an operational failure without attaching form values, coordinates,
 * images or any other user-provided data. The short context is deliberately a
 * fixed call-site label so Sentry remains useful without becoming a second
 * store of personal information.
 */
export function reportError(error: unknown, context: string) {
  const exception = error instanceof Error ? error : new Error("Unknown application error");

  Sentry.captureException(exception, {
    tags: { app_context: context },
  });
}
