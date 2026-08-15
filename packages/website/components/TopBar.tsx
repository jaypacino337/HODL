"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function TopBar({ ticker }: { ticker: string }) {
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString([], { hour12: false }) + " · " + new Date().toLocaleDateString());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="border-b border-term-border bg-term-panel">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="border border-amber bg-amber px-2 py-0.5 text-[15px] font-bold text-term-bg">A:</span>
          <div>
            <div className="text-[15px] font-bold uppercase tracking-[0.22em] text-amber">
              Attention Markets
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-dim">
              Attention is currency. Attention is power.
            </div>
          </div>
          <span className="badge ml-2 hidden border-term-bright text-cyan sm:inline-block">{ticker}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="num hidden text-[11px] text-dim md:inline">{clock}</span>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
