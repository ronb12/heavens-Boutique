import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, Great_Vibes } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { StoreSettingsProvider } from "@/components/StoreSettingsProvider";
import { getSiteOrigin } from "@/lib/siteUrl";

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const script = Great_Vibes({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400"],
});

const siteOrigin = getSiteOrigin();
const defaultDescription =
  "Curated · Feminine · Timeless. Shop Heaven’s Boutique on web and iOS—new arrivals, saved favorites, and secure checkout.";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Heaven’s Boutique — Curated fashion & elegance",
  description: defaultDescription,
  /** Explicit ICO + PNG + Apple touch so browsers get icons on first paint (not only streamed metadata). */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/icon.png", type: "image/png", sizes: "1024x1024" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteOrigin,
    siteName: "Heaven’s Boutique",
    title: "Heaven’s Boutique — Curated fashion & elegance",
    description: defaultDescription,
    images: [{ url: "/icon.png", width: 1024, height: 1024, alt: "Heaven’s Boutique" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Heaven’s Boutique — Curated fashion & elegance",
    description: defaultDescription,
    images: ["/icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${display.variable} ${script.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <StoreSettingsProvider>
            <CartProvider>{children}</CartProvider>
          </StoreSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
