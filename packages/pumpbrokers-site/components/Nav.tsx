"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useStats } from "../lib/useStats";

// The wallet button reads `window` on mount; rendering it server-side produces a
// hydration mismatch on every page load.
const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false, loading: () => <span className="btn text-xs">CONNECT</span> },
);

const LINKS = [
  { href: "/", label: "HOME" },
  { href: "/mint", label: "MINT" },
  { href: "/brokers", label: "MY BROKERS" },
  { href: "/gallery", label: "GALLERY" },
  { href: "/airdrop", label: "AIRDROP" },
];

export function Nav() {
  const path = usePathname();
  const { publicKey } = useWallet();
  const { stats } = useStats();

  return (
    <header className="sticky top-0 z-40 border-b-2 border-edge bg-ink/95 backdrop-blur-none">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="border-2 border-neon bg-neon px-1.5 py-0.5 text-sm font-bold text-ink">
            PB
          </span>
          <span className="hidden text-sm font-bold tracking-widest sm:inline">
            PUMPBROKERS
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap border-2 px-2 py-1.5 text-[10px] tracking-widest ${
                  active
                    ? "border-neon text-neon"
                    : "border-transparent text-mute hover:text-bone"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {stats ? (
            <span className="label tnum hidden md:inline">
              {stats.minted} / {stats.totalSupply}
            </span>
          ) : null}
          <WalletMultiButton
            style={{
              background: publicKey ? "#11161B" : "#22FF6A",
              color: publicKey ? "#F2F4F0" : "#0A0D10",
              border: `2px solid ${publicKey ? "#1E262D" : "#22FF6A"}`,
              borderRadius: 0,
              height: 38,
              fontSize: 11,
              letterSpacing: "0.1em",
              fontFamily: "inherit",
              fontWeight: 700,
            }}
          />
        </div>
      </div>
    </header>
  );
}
