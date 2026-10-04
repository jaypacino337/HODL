"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { SITE } from "../../../config/rally.ts";
import { GateBadge } from "./GateBadge.tsx";

// Reads `window` on mount — server-rendering it produces a hydration mismatch.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <span className="btn btn-primary text-xs">Connect</span> },
);

const LINKS = [
  { href: "/", label: "Campaigns" },
  { href: "/create", label: "Start one" },
  { href: "/me", label: "Mine" },
];

export function Nav() {
  const path = usePathname();
  const { publicKey } = useWallet();

  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 -rotate-6 place-items-center rounded-md border-2 border-ink bg-accent text-base font-extrabold text-white shadow-card">
            R!
          </span>
          <span className="hidden text-lg font-extrabold tracking-tight sm:inline">{SITE.name}</span>
        </Link>

        <nav className="ml-2 flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                path === l.href ? "bg-raised text-text" : "text-muted hover:text-text"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {publicKey ? <GateBadge compact /> : null}
          <WalletMultiButton
            style={{
              background: publicKey ? "#FFFCF6" : "#FF4A1C",
              color: publicKey ? "#17150F" : "#fff",
              border: "2px solid #17150F",
              boxShadow: "3px 3px 0 #17150F",
              borderRadius: 10,
              height: 38,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>
    </header>
  );
}
