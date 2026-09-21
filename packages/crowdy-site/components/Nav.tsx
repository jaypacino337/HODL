"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { SITE } from "../../../config/crowdy.ts";
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
    <header className="sticky top-0 z-40 border-b border-edge bg-bg/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm text-white">
            C
          </span>
          <span className="hidden sm:inline">{SITE.name}</span>
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
              background: publicKey ? "#1C1C28" : "#7C5CFF",
              color: publicKey ? "#ECECF3" : "#fff",
              border: `1px solid ${publicKey ? "#252533" : "transparent"}`,
              borderRadius: 14,
              height: 38,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
            }}
          />
        </div>
      </div>
    </header>
  );
}
