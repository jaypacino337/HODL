import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sherwood Protocol ($ARROW) — Take from the trades. Give to the holders.",
  description:
    "Sherwood Protocol is a Solana token that harvests its own trading fees, compounds a share into liquidity, and airdrops the rest back to holders every 15 minutes.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🏹</text></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
