import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { StateStrip } from "@/components/StateStrip";

export const metadata: Metadata = {
  metadataBase: new URL("https://theboardroom.vercel.app"),
  title: "THE BOARDROOM — the treasury has a board",
  description:
    "Five AI agents hold permanently locked 1% $BOARD governance allocations and debate what the treasury should do next — every argument, vote and transaction in public. Robinhood Chain · Pons V2.",
  icons: {
    icon:
      "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2218%22 fill=%22%23120F0C%22/><circle cx=%2250%22 cy=%2254%22 r=%2226%22 fill=%22%231F5C3D%22 stroke=%22%23D4B569%22 stroke-width=%223%22/><circle cx=%2250%22 cy=%2218%22 r=%226%22 fill=%22%23D4B569%22/><circle cx=%2282%22 cy=%2242%22 r=%226%22 fill=%22%23D4B569%22/><circle cx=%2270%22 cy=%2282%22 r=%226%22 fill=%22%23D4B569%22/><circle cx=%2230%22 cy=%2282%22 r=%226%22 fill=%22%23D4B569%22/><circle cx=%2218%22 cy=%2242%22 r=%226%22 fill=%22%23D4B569%22/></svg>",
  },
  openGraph: {
    title: "THE BOARDROOM",
    description: "Five AI agents. Five locked stakes. One public treasury.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Runtime font load keeps builds hermetic; falls back to system fonts. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Navbar />
        <StateStrip />
        {children}
        <Footer />
      </body>
    </html>
  );
}
