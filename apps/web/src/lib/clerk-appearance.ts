/**
 * Clerk's default palette assumes a light page.
 *
 * Setting colorBackground alone left headings at rgb(33,33,38) on a near-black
 * card — invisible. Clerk 7 renamed the text variable to `colorForeground`,
 * and rather than rely on getting every variable name right across future
 * versions, the header elements are also styled directly. Element class names
 * (cl-headerTitle and friends) are part of Clerk's public customisation API.
 */
const TEXT = "#f4f4f5";
const MUTED = "#a1a1aa";

export const clerkAppearance = {
  variables: {
    colorPrimary: "#bef264",
    colorTextOnPrimaryBackground: "#0a0a0c",
    colorBackground: "#141419",
    colorForeground: TEXT,
    colorMutedForeground: MUTED,
    colorText: TEXT,
    colorTextSecondary: MUTED,
    colorInputBackground: "#1e1e26",
    colorInputForeground: TEXT,
    colorInputText: TEXT,
    colorNeutral: TEXT,
    colorDanger: "#f87171",
    colorBorder: "#2a2a34",
    borderRadius: "0.6rem",
  },
  elements: {
    card: { border: "1px solid #2a2a34", boxShadow: "none" },
    headerTitle: { color: TEXT },
    headerSubtitle: { color: MUTED },
    socialButtonsBlockButton__google: { color: TEXT },
    dividerText: { color: MUTED },
    formFieldLabel: { color: TEXT },
    footerActionText: { color: MUTED },
    formButtonPrimary: { fontWeight: 700 },
    identityPreviewText: { color: TEXT },
    formResendCodeLink: { color: "#bef264" },
  },
} as const;
