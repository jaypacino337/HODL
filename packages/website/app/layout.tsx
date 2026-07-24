import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://overbid.vercel.app"),
  title: "OVERBID — Trade where housing goes next",
  description:
    "A real-estate prediction market. Buy city-outcome shares in USDG, priced by an on-chain AMM and settled against housing price indexes. Five protocol-funded launch markets. Built for Robinhood Chain. Perps coming soon.",
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "OVERBID — Trade the cities",
    description:
      "Miami vs New York vs Austin: which housing market rises most? Trade the outcome. LPs earn the fees, indexes settle the truth.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Loaded at runtime so builds stay hermetic; falls back to system fonts. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
