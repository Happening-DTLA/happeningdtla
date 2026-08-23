/**
 * Mirrors the web app's tokens (apps/web/src/app/globals.css) so the two
 * surfaces read as one product. Dark-first on purpose: this is used at night,
 * outdoors, on a phone, often one-handed.
 */
export const theme = {
  bg: "#0a0a0c",
  surface: "#141419",
  surface2: "#1e1e26",
  border: "#2a2a34",
  text: "#f4f4f5",
  textMuted: "#a1a1aa",
  accent: "#bef264",
  accentInk: "#0a0a0c",
  danger: "#f87171",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
