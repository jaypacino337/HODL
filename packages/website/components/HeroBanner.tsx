"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchGameState } from "@/lib/api";

export function HeroBanner() {
  const [episode, setEpisode] = useState<number | null>(null);

  useEffect(() => {
    fetchGameState()
      .then((s) => setEpisode(s.round?.roundNumber ?? null))
      .catch(() => {});
  }, []);

  return (
    <header className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-14 pt-10 text-center">
      <div className="eyebrow rounded-full border border-gold-400/40 bg-stage-900/70 px-6 py-2.5">
        On-chain game show{episode !== null ? ` / Episode ${String(episode).padStart(3, "0")}` : ""}
      </div>

      <Image
        src="/banner.png"
        alt="HODL OR NO HODL — what's in the box?"
        width={1086}
        height={362}
        priority
        className="mt-8 w-full max-w-4xl rounded-2xl shadow-glow-red"
      />
      <h1 className="sr-only">HODL OR NO HODL</h1>

      <p className="mt-8 max-w-2xl text-lg font-semibold leading-relaxed text-cream/90">
        Every <span className="gold-text font-bold">15 minutes</span> the creator fees fill the box.
        Hold <span className="gold-text font-bold">1,000,000+ tokens</span> and the call is yours:
        stand with the holders or bet against them. If the flip lands your way, the box opens and you
        split the pot — <span className="red-text font-bold">weighted by the size of your bag</span>.
        Conviction, cooperation, betrayal. Live on Solana.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <a href="#play" className="btn btn-red">
          Enter Game ↘
        </a>
        <a href="#rules" className="btn btn-ghost">
          Read the Rules
        </a>
      </div>
    </header>
  );
}
