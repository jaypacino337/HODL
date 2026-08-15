import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://attentionmarkets.fun"),
  title: "ATTENTION MARKETS — the attention terminal",
  description:
    "Attention is currency. Attention is power. The terminal scans the markets, pays the people driving attention, and turns fees into buybacks: creator fees 50% buybacks / 50% attention rewards, revenue 90% buybacks / 10% development.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23050807%22/><text x=%2250%22 y=%2268%22 font-family=%22monospace%22 font-size=%2248%22 font-weight=%22bold%22 fill=%22%23FFB000%22 text-anchor=%22middle%22>A:</text></svg>",
  },
  openGraph: {
    title: "ATTENTION MARKETS",
    description: "Attention is currency. Attention is power.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Runtime font load keeps builds hermetic; falls back to system mono. */}
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
