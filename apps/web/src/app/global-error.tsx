"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a0c", color: "#f4f0e8" }}>
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "96px 24px" }}>
          <p style={{ color: "#ffcf33", fontWeight: 800, textTransform: "uppercase" }}>
            Temporary interruption
          </p>
          <h1 style={{ fontSize: 48, lineHeight: 1, textTransform: "uppercase" }}>
            DTLA Art Night is still here.
          </h1>
          <p>Reload the page. If this keeps happening, contact info@dtlaartnight.com.</p>
          <Link style={{ color: "#ffcf33", fontWeight: 800 }} href="/">
            Return home
          </Link>
        </main>
      </body>
    </html>
  );
}
