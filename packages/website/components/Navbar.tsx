"use client";

import Image from "next/image";
import dynamic from "next/dynamic";

// The wallet button renders differently server vs client — load client-only.
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-ember-700/30 bg-stage-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <a href="#" className="flex items-center gap-3">
          <Image src="/logo.png" alt="HODL OR NO HODL" width={44} height={44} className="rounded-lg" />
          <span className="font-display text-xl tracking-wide text-gold-metal hidden sm:block">
            HODL OR NO HODL
          </span>
        </a>
        <div className="flex items-center gap-4">
          <a href="#play" className="text-sm font-semibold text-gold-300 hover:text-gold-200">
            Play
          </a>
          <a href="#how" className="text-sm font-semibold text-gold-300 hover:text-gold-200 hidden sm:block">
            How it works
          </a>
          <a href="#history" className="text-sm font-semibold text-gold-300 hover:text-gold-200 hidden sm:block">
            Rounds
          </a>
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}
