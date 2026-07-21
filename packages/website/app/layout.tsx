import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.hodlornohodl.fun"),
  title: "HODL OR NO HODL — the on-chain game show",
  description:
    "Every 15 minutes the creator fees fund the pot. Hold 500K+ tokens, pick your side — HODL or NO HODL — and if the flip lands your way, the pot pays out weighted by how much you hold.",
  icons: { icon: "/logo.png" },
  openGraph: {
    title: "HODL OR NO HODL",
    description: "Pick a side every 15 minutes. Winners split the creator-fee pot, weighted by their bags.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Loaded at runtime so builds stay hermetic; falls back to Impact. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased bg-stage-spotlight min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
