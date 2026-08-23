import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DTLAHappening — what's on in Downtown LA",
  description:
    "Every gallery, rooftop and warehouse opening in Downtown Los Angeles. Tickets live here and nowhere else.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  // Phone-first: the layout must sit under the notch rather than beside it.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
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
            <Link
              href="/tickets"
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              My tickets
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16">{children}</main>
        <footer className="border-t border-border px-4 py-8 text-center text-xs text-text-muted">
          Downtown Los Angeles
        </footer>
      </body>
    </html>
  );
}
