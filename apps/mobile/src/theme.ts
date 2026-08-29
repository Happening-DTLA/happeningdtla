import type { TextStyle } from "react-native";

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

/**
 * Corners, or the lack of them.
 *
 * The visual direction is the gig poster: paper that was cut, screenprinted and
 * stapled to a wall. Cut paper has corners, so surfaces are square. The pill is
 * the single deliberate exception — a round chip against hard blocks is the
 * contrast that makes both look chosen, and it also marks "this is a control"
 * versus "this is content".
 */
export const radius = {
  block: 0,
  control: 2,
  pill: 999,
} as const;

/**
 * The typefaces.
 *
 * Archivo Black for anything that would be set large on a poster, Archivo for
 * everything a poster would set small. One superfamily so the two never fight,
 * and the poster feeling comes from the treatment — uppercase, tight tracking,
 * a hard jump in scale — rather than from a novelty face that would date.
 *
 * These names are the PostScript names the font files register under. A typo
 * here does not throw; React Native silently falls back to the system face and
 * the app quietly looks like every other React Native app, which is the exact
 * problem this file exists to solve. `assertFontsLoaded` in _layout guards it.
 */
export const font = {
  display: "ArchivoBlack_400Regular",
  bold: "Archivo_700Bold",
  medium: "Archivo_500Medium",
  regular: "Archivo_400Regular",
} as const;

/**
 * The type scale.
 *
 * Deliberately gapped rather than evenly stepped. A flyer has two or three
 * sizes — the thing shouting and the things explaining it — and the distance
 * between them is what reads as designed. Evenly-spaced sizes are what makes
 * an interface look generated.
 */
export const type = {
  /** The one thing on screen that shouts. One per screen, at most. */
  poster: {
    fontFamily: font.display,
    fontSize: 34,
    lineHeight: 35,
    letterSpacing: -1.1,
    textTransform: "uppercase",
  } as TextStyle,

  /** A headline inside a block — an event title on a card. */
  title: {
    fontFamily: font.display,
    fontSize: 19,
    lineHeight: 21,
    letterSpacing: -0.5,
    textTransform: "uppercase",
  } as TextStyle,

  heading: {
    fontFamily: font.bold,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
  } as TextStyle,

  body: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
  } as TextStyle,

  meta: {
    fontFamily: font.medium,
    fontSize: 13,
    lineHeight: 18,
  } as TextStyle,

  /** Small caps, wide. The printed rule's caption. */
  label: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1.7,
    textTransform: "uppercase",
  } as TextStyle,

  /** Money and counts. Poster numerals — large, black, tight. */
  numeral: {
    fontFamily: font.display,
    fontSize: 19,
    letterSpacing: -0.6,
  } as TextStyle,
} as const;

/**
 * Readable ink for a given background colour.
 *
 * Corridor colours come from the organisers and run from a pale yellow to a
 * dark green, so a fixed label colour is illegible at one end of that range.
 * Relative luminance — the same rule WCAG contrast uses — picks the side to
 * land on, which means a corridor added next year is legible without anyone
 * choosing a text colour for it.
 */
export function inkOn(hex: string): string {
  const h = hex.replace("#", "");
  const channel = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.42 ? "#0a0a0c" : "#ffffff";
}
