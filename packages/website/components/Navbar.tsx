"use client";

import Link from "next/link";
import { useDemoCtx } from "@/lib/DemoContext";
import { fmtUsd } from "@/lib/format";

export function Navbar() {
  const { state, ready } = useDemoCtx();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="h-8 w-8" />
          <span className="display text-lg tracking-[0.08em] text-paper">
            OVER<span className="text-up-500">BID</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-moss md:flex">
          <Link href="/#markets" className="hover:text-paper">
            Markets
          </Link>
          <Link href="/pool" className="hover:text-paper">
            House Pool
          </Link>
          <Link href="/#how" className="hover:text-paper">
            How it works
          </Link>
          <Link href="/#tech" className="hover:text-paper">
            Tech
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <span className="chip" title="Paper-trading balance — resets any time">
            <span className="h-1.5 w-1.5 rounded-full bg-up-500" />
            demo&nbsp;
            <b className="text-paper">{ready ? fmtUsd(state.cash, 0) : "10,000"} USDG</b>
          </span>
          <Link href="/#markets" className="btn btn-primary hidden !py-2 text-xs sm:inline-flex">
            Trade
          </Link>
        </div>
      </div>
    </header>
  );
}
