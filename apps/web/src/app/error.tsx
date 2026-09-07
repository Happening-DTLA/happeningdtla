"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="page-shell legal-copy">
      <p className="eyebrow">Temporary interruption</p>
      <h1>That page hit a snag.</h1>
      <p>Try it once more. If it keeps happening, tell us what you were opening.</p>
      <button className="button primary" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
