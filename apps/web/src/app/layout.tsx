import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DTLAHappening — what's on in Downtown LA",
  description:
    "Every gallery, rooftop and warehouse opening in Downtown Los Angeles. Tickets live here and nowhere else.",
  // Makes iOS treat a home-screen launch as an app: no Safari chrome, and the
  // status bar blends into the dark header instead of sitting on white.
  appleWebApp: {
    capable: true,
    title: "DTLA",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  // Phone-first: the layout must sit under the notch rather than beside it.
  viewportFit: "cover",
};

/**
 * ClerkProvider is applied only when configured. Rendering it without keys
 * throws, and the app is deliberately usable before organizer accounts exist —
 * browsing and buying tickets don't need an account at all.
 */
const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() && process.env.CLERK_SECRET_KEY?.trim(),
);

export default function RootLayout({ children }: LayoutProps<"/">) {
  const page = (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <Link href="/" className="font-mono text-sm font-bold tracking-tight">
              DTLA<span className="text-accent">Happening</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/tickets"
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
              >
                My tickets
              </Link>
              {clerkConfigured ? (
                <>
                  {/* Clerk Core 3 replaced SignedIn/SignedOut with <Show>.
                      Note it only HIDES children — it is not an authorization
                      boundary. Everything that actually guards data does its
                      own server-side check. */}
                  <Show when="signed-out">
                    {/* Buying a ticket never requires an account. This is for
                        people who want tickets across devices, and for anyone
                        running a venue. */}
                    <SignInButton mode="modal">
                      <button
                        type="button"
                        className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink"
                      >
                        Sign in
                      </button>
                    </SignInButton>
                  </Show>
                  <Show when="signed-in">
                    <UserButton
                      appearance={{ elements: { avatarBox: { width: 28, height: 28 } } }}
                      userProfileProps={{ appearance: clerkAppearance }}
                    />
                  </Show>
                </>
              ) : null}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">{children}</main>
        <footer className="border-t border-border px-4 py-8 text-center text-xs text-text-muted">
          Downtown Los Angeles
        </footer>
      </body>
    </html>
  );

  return clerkConfigured ? <ClerkProvider>{page}</ClerkProvider> : page;
}
