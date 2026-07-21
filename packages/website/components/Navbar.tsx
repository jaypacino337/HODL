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
    <>
      <div className="lights" />
      <nav className="sticky top-0 z-40 border-b border-gold-400/20 bg-stage-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <a href="#" className="flex items-center gap-3">
            <Image src="/logo.png" alt="HODL OR NO HODL" width={42} height={42} className="rounded-md shadow-glow-red" />
            <span className="anton text-lg tracking-wide">
              HODL <span className="red-text">OR NO</span> HODL
              <span className="text-gold-400">.FUN</span>
            </span>
          </a>
          <div className="flex items-center gap-4">
            <a href="#play" className="hidden text-sm font-bold uppercase tracking-wider text-gold-300 hover:text-gold-200 sm:block">
              Play
            </a>
            <a href="#rules" className="hidden text-sm font-bold uppercase tracking-wider text-gold-300 hover:text-gold-200 sm:block">
              Rules
            </a>
            <a href="#history" className="hidden text-sm font-bold uppercase tracking-wider text-gold-300 hover:text-gold-200 md:block">
              Season
            </a>
            <WalletMultiButton />
          </div>
        </div>
      </nav>
    </>
  );
}
