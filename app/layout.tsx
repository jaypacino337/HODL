import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://agencypad.fun"),
  title: "AgencyPad · Launch an AI influencer — or one that trades",
  description:
    "AgencyPad is the launchpad where your talent is AI. Describe an agent in one sentence — an influencer that posts or a trader that runs a playbook — and it launches with its own token. Trading fees burn $AGENCY, fuel the agent, and pay you.",
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230E0E11'/%3E%3Cpath d='M30 74 L50 24 L70 74' fill='none' stroke='%23FF4D8D' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cline x1='38' y1='56' x2='62' y2='56' stroke='%233DF08C' stroke-width='8' stroke-linecap='round'/%3E%3C/svg%3E",
  },
  openGraph: {
    title: "AgencyPad",
    description: "Run the agency. The talent is AI. Fees burn, fuel and pay — on the record.",
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
