"use client";

import Link from "next/link";
import { useState } from "react";

const LINKS = [
  ["/session", "Session"],
  ["/agents", "The Board"],
  ["/treasury", "Treasury"],
  ["/proposals", "Proposals"],
  ["/governance", "Governance"],
  ["/receipts", "Receipts"],
  ["/token", "$BOARD"],
  ["/docs", "Docs"],
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-brass-500/20 bg-ink-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <svg viewBox="0 0 100 100" className="h-8 w-8" aria-hidden>
            <circle cx="50" cy="54" r="26" fill="#1F5C3D" stroke="#D4B569" strokeWidth="3" />
            <circle cx="50" cy="18" r="6" fill="#D4B569" />
            <circle cx="82" cy="42" r="6" fill="#D4B569" />
            <circle cx="70" cy="82" r="6" fill="#D4B569" />
            <circle cx="30" cy="82" r="6" fill="#D4B569" />
            <circle cx="18" cy="42" r="6" fill="#D4B569" />
          </svg>
          <span className="display text-sm tracking-wide text-cream sm:text-base">
            THE <span className="text-brass-400">BOARDROOM</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-5 text-[0.8rem] font-medium text-cream-dim lg:flex">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className="transition hover:text-cream">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/session" className="btn btn-brass hidden !px-4 !py-2 sm:inline-flex">
            Enter the Boardroom
          </Link>
          <button className="text-cream lg:hidden" onClick={() => setOpen(!open)} aria-label="menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-brass-500/20 bg-ink-900 px-4 py-3 lg:hidden">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="block py-2 text-sm text-cream-dim hover:text-cream">
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
