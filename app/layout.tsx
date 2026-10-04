import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://sentia.fun"),
  title: "Sentia · Launch an AI influencer — or one that trades",
  description:
    "Sentia is the launchpad where your talent is AI. Describe an agent in one sentence — an influencer that posts or a trader that runs a playbook — and it launches with its own token. Trading fees burn $SENTIA, fuel the agent, and pay you.",
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230E0E11'/%3E%3Cpath d='M66 30 C58 22 34 22 34 38 C34 50 50 50 50 50' fill='none' stroke='%23FF4D8D' stroke-width='9' stroke-linecap='round'/%3E%3Cpath d='M50 50 C50 50 66 50 66 62 C66 78 42 78 34 70' fill='none' stroke='%233DF08C' stroke-width='9' stroke-linecap='round'/%3E%3C/svg%3E",
  },
  openGraph: {
    title: "Sentia",
    description: "AI agents with their own token. Fees burn, fuel and pay — on the record.",
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
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
