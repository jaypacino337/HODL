import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://outlet-amm.vercel.app"),
  title: "Outlet · Appliances for liquidity pools",
  description:
    "Outlet is a concentrated-liquidity AMM where every pool has one outlet: a program that runs before and after swaps and liquidity changes, inside limits fixed at pool creation. Dynamic fees, a TWAP oracle and range orders plug in as appliances — anything else can too.",
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23151514'/%3E%3Crect x='26' y='20' width='48' height='60' rx='12' fill='%23F2EFE7'/%3E%3Crect x='38' y='34' width='7' height='16' rx='2' fill='%23151514'/%3E%3Crect x='55' y='34' width='7' height='16' rx='2' fill='%23151514'/%3E%3Ccircle cx='50' cy='63' r='5' fill='%23E85D04'/%3E%3C/svg%3E",
  },
  openGraph: {
    title: "Outlet",
    description: "One outlet, any appliance. Ideas ship as appliances, not new AMMs.",
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
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
