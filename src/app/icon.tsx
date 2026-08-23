import { ImageResponse } from "next/og";

export const contentType = "image/png";

/**
 * Home-screen icons, generated rather than shipped as binaries so there's no
 * design tooling in the loop while the brand is still moving. Replace with real
 * artwork before launch — this is a placeholder that looks deliberate, not final.
 *
 * PWA install requires both a 192 and a 512.
 */
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType },
    { id: "512", size: { width: 512, height: 512 }, contentType },
  ];
}

// NOTE: with generateImageMetadata, `id` arrives as a PROMISE, not a string.
// Forgetting to await it yields `fontSize: NaN` and a 500, not a type error.
export default async function Icon({ id }: { id: Promise<string> }) {
  const px = Number(await id);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0c",
          color: "#bef264",
          fontWeight: 800,
        }}
      >
        <div style={{ fontSize: px * 0.42, lineHeight: 1, letterSpacing: -px * 0.02 }}>DH</div>
        <div
          style={{
            fontSize: px * 0.1,
            letterSpacing: px * 0.02,
            color: "#a1a1aa",
            marginTop: px * 0.05,
          }}
        >
          DTLA
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
