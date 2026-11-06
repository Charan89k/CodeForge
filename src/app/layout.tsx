import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Sans, JetBrains_Mono, Source_Serif_4 } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getMotionPreference } from "@/lib/auth/session";
import { site } from "@/lib/site";

import "./globals.css";

// IBM Plex Sans for everything a learner reads and operates, headings
// included; JetBrains Mono for code, numbers and the mono section labels.
// The developer-tool pairing UI UX Pro Max recommends for documentation and
// code products. Self-hosted by next/font at build time.
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

// Headings and long-form reading on the Learn surface only.
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "data structures",
    "algorithms",
    "coding interview",
    "system design",
    "low level design",
    "algorithm patterns",
    "interview preparation",
  ],
  authors: [{ name: site.name }],
  openGraph: {
    type: "website",
    locale: site.locale,
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  // Matches --background in the dark theme so the mobile browser chrome does
  // not flash white before first paint.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#060c19" },
    { media: "(prefers-color-scheme: light)", color: "#f9fafd" },
  ],
  colorScheme: "dark light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // next-themes injects a small blocking script that applies the stored theme
  // before first paint, avoiding a flash of the wrong colours. Under the
  // production CSP that script needs the same per-request nonce proxy.ts
  // minted; without it the browser refuses it and the page flashes light.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // The saved reduced-motion preference, rendered as an attribute rather
  // than passed through context: CSS needs it too, and an attribute on
  // <body> is correct on first paint with no client round-trip. The OS
  // media query is honoured independently in globals.css and always wins.
  const reducedMotion = await getMotionPreference();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${jetbrainsMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body
        className="flex min-h-full flex-col"
        data-reduced-motion={reducedMotion ? "true" : undefined}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <TooltipProvider delayDuration={200}>
            {/* First tab stop on every page. */}
            <a
              href="#main"
              className="sr-only rounded-md bg-background px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:ring-2 focus:ring-ring"
            >
              Skip to content
            </a>
            {children}
          </TooltipProvider>
          <Toaster position="bottom-right" closeButton richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
