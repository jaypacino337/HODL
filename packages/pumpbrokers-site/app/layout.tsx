import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "PumpBrokers — 1,000 pixel brokers on Solana",
  description:
    "1,000 pixel brokers. Mint for 1,000,000 $PUMPBROKER. Sell one back for 950,000 any time the treasury can cover it.",
  openGraph: {
    title: "PumpBrokers",
    description: "1,000 pixel brokers on Solana. Mint, hold, sell back.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0D10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-bone">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-6">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
