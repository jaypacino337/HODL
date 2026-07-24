"use client";

import { LAUNCH_MARKETS, impliedProbabilities } from "@overbid/shared";
import { useDemoCtx } from "@/lib/DemoContext";
import { fmtCents } from "@/lib/format";

/** Scrolling price strip under the navbar — every outcome on the board. */
export function Ticker() {
  const { state } = useDemoCtx();

  const items = LAUNCH_MARKETS.flatMap((m) => {
    const pools = state.amm[m.slug]?.pools ?? m.initialPools;
    const probs = impliedProbabilities(pools);
    return m.outcomes.map((o, i) => ({
      key: `${m.slug}:${o.id}`,
      label: `${m.question.replace("?", "")} · ${o.label}`,
      price: probs[i],
    }));
  });

  const strip = [...items, ...items]; // doubled for a seamless loop

  return (
    <div className="overflow-hidden border-b border-line bg-ink-900/70">
      <div className="ticker flex w-max items-center gap-8 px-4 py-2">
        {strip.map((it, idx) => (
          <span key={`${it.key}-${idx}`} className="flex items-center gap-2 font-mono text-[0.72rem] text-moss">
            <span className="uppercase tracking-wider">{it.label}</span>
            <b className={it.price >= 0.5 ? "text-up-400" : "text-paddle-400"}>{fmtCents(it.price)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
