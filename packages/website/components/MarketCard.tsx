"use client";

import Link from "next/link";
import { impliedProbabilities, probabilityHistory, type MarketDef } from "@overbid/shared";
import { useDemoCtx } from "@/lib/DemoContext";
import { fmtCents, fmtCompact, fmtDate } from "@/lib/format";
import { Sparkline } from "./Sparkline";

const CATEGORY_LABEL: Record<MarketDef["category"], string> = {
  "city-race": "City race",
  "head-to-head": "Head-to-head",
  binary: "Yes / No",
};

export function MarketCard({ market }: { market: MarketDef }) {
  const { state } = useDemoCtx();
  const amm = state.amm[market.slug];
  const pools = amm?.pools ?? market.initialPools;
  const probs = impliedProbabilities(pools);
  const leaderIdx = probs.indexOf(Math.max(...probs));
  const traded = Math.max(0, (amm?.collateral ?? market.seedLiquidityUsd) - market.seedLiquidityUsd);

  return (
    <Link href={`/markets/${market.slug}`} className="card card-hover flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="chip mb-2">{CATEGORY_LABEL[market.category]}</div>
          <h3 className="display text-lg leading-snug text-paper">{market.question}</h3>
          <p className="mt-1 text-sm text-moss">{market.tagline}</p>
        </div>
        <Sparkline points={probabilityHistory(market.slug, market.outcomes[leaderIdx].id, probs[leaderIdx])} />
      </div>

      <div className="flex flex-col gap-2.5">
        {market.outcomes.map((o, i) => (
          <div key={o.id} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-sm font-semibold text-paper">{o.label}</span>
            <div className="prob-track">
              <div
                className={`prob-fill ${i === leaderIdx ? "" : "cold"}`}
                style={{ width: `${Math.max(probs[i] * 100, 3)}%` }}
              />
            </div>
            <span className="price-tag w-14 shrink-0 text-center">{fmtCents(probs[i])}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-line pt-3 font-mono text-[0.72rem] uppercase tracking-[0.14em] text-moss">
        <span>
          ${fmtCompact(market.seedLiquidityUsd)} seed{traded > 1 ? ` + $${fmtCompact(traded)} traded` : ""}
        </span>
        <span>locks {fmtDate(market.locksAt)}</span>
      </div>
    </Link>
  );
}
