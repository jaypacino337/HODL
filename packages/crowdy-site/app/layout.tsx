import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers.tsx";
import { Nav } from "../components/Nav.tsx";
import { Footer } from "../components/Footer.tsx";
import { SITE } from "../../../config/crowdy.ts";

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  openGraph: { title: SITE.name, description: SITE.description, type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#0B0B10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
