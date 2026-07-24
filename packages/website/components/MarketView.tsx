"use client";

import { useState } from "react";
import Link from "next/link";
import { getMarket, impliedProbabilities, probabilityHistory } from "@overbid/shared";
import { useDemoCtx } from "@/lib/DemoContext";
import { fmtCents, fmtDate, fmtUsd } from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { TradePanel } from "./TradePanel";

const RULE_LABEL = {
  "max-gain": "Biggest % index gain wins",
  threshold: "YES wins at or above the threshold",
  positive: "YES wins if the change is positive",
} as const;

export function MarketView({ slug }: { slug: string }) {
  const market = getMarket(slug)!;
  const { state } = useDemoCtx();
  const [selected, setSelected] = useState(0);

  const amm = state.amm[slug];
  const pools = amm?.pools ?? market.initialPools;
  const probs = impliedProbabilities(pools);
  const positions = state.positions[slug] ?? {};

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/#markets" className="font-mono text-xs uppercase tracking-[0.18em] text-moss hover:text-paper">
        ← All markets
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="display text-3xl md:text-4xl">{market.question}</h1>
          <p className="mt-2 text-moss">{market.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="chip">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up-500" />
            {market.status === "open" ? "trading open" : market.status}
          </span>
          <span className="font-mono text-xs text-moss">locks {fmtDate(market.locksAt)}</span>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.7fr,1fr]">
        {/* outcomes */}
        <div className="flex flex-col gap-4">
          {market.outcomes.map((o, i) => {
            const held = positions[i] ?? 0;
            const active = i === selected;
            return (
              <button
                key={o.id}
                onClick={() => setSelected(i)}
                className={`card card-hover flex items-center gap-4 p-4 text-left ${
                  active ? "border-up-500/60 shadow-glow-up" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-3">
                    <span className="display truncate text-lg">{o.label}</span>
                    {held > 0.01 && (
                      <span className="chip !border-up-500/40 !text-up-400">{fmtUsd(held, 0)} shares</span>
                    )}
                  </div>
                  {o.thesis && <p className="mt-1 truncate text-sm text-moss">{o.thesis}</p>}
                  <div className="prob-track mt-3">
                    <div className="prob-fill" style={{ width: `${Math.max(probs[i] * 100, 3)}%` }} />
                  </div>
                </div>
                <Sparkline points={probabilityHistory(slug, o.id, probs[i])} width={96} height={30} />
                <div className="w-16 text-right">
                  <div className="price-tag inline-block">{fmtCents(probs[i])}</div>
                  <div className="mt-1 font-mono text-[0.65rem] uppercase tracking-wider text-moss">
                    {(probs[i] * 100).toFixed(1)}%
                  </div>
                </div>
              </button>
            );
          })}

          {/* settlement terms */}
          <div className="card p-5">
            <div className="eyebrow mb-3">Settlement terms</div>
            <div className="stat-row">
              <span className="k">Rule</span>
              <span className="v">{RULE_LABEL[market.rule.kind]}</span>
            </div>
            {market.rule.thresholdPct !== undefined && (
              <div className="stat-row">
                <span className="k">Threshold</span>
                <span className="v">+{market.rule.thresholdPct}%</span>
              </div>
            )}
            <div className="stat-row">
              <span className="k">Metric</span>
              <span className="v">{market.rule.metric}</span>
            </div>
            <div className="stat-row">
              <span className="k">Window</span>
              <span className="v">
                {fmtDate(market.rule.windowStart)} → {fmtDate(market.rule.windowEnd)}
              </span>
            </div>
            <div className="stat-row">
              <span className="k">Data source</span>
              <span className="v text-right">{market.rule.source}</span>
            </div>
            <div className="stat-row">
              <span className="k">Settles</span>
              <span className="v">{fmtDate(market.settlesAt)}</span>
            </div>
            <div className="stat-row">
              <span className="k">Creator</span>
              <span className="v">OVERBID protocol → fees to House Pool</span>
            </div>
            <div className="stat-row">
              <span className="k">Seed liquidity</span>
              <span className="v">{fmtUsd(market.seedLiquidityUsd, 0)} USDG</span>
            </div>
          </div>
        </div>

        {/* trade panel */}
        <TradePanel slug={slug} selected={selected} onSelect={setSelected} />
      </div>
    </main>
  );
}
