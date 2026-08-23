import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home screen — iOS ignores the manifest icons and uses this one. */
export default function AppleIcon() {
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
        <div style={{ fontSize: 76, lineHeight: 1, letterSpacing: -3 }}>DH</div>
        <div style={{ fontSize: 18, letterSpacing: 4, color: "#a1a1aa", marginTop: 9 }}>
          DTLA
        </div>
      </div>
    ),
    { ...size },
  );
}
