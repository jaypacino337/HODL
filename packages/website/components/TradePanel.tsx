"use client";

import { useMemo, useState } from "react";
import { getMarket, impliedProbabilities, quoteBuy, quoteSell } from "@overbid/shared";
import { useDemoCtx } from "@/lib/DemoContext";
import { fmtCents, fmtUsd } from "@/lib/format";

export function TradePanel({
  slug,
  selected,
  onSelect,
}: {
  slug: string;
  selected: number;
  onSelect: (i: number) => void;
}) {
  const market = getMarket(slug)!;
  const { state, ready, buy, sell } = useDemoCtx();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("100");
  const [toast, setToast] = useState<string | null>(null);

  const amm = state.amm[slug];
  const pools = amm?.pools ?? market.initialPools;
  const probs = impliedProbabilities(pools);
  const held = state.positions[slug]?.[selected] ?? 0;
  const num = Number(amount) || 0;

  const quote = useMemo(() => {
    if (num <= 0) return null;
    return side === "buy" ? quoteBuy(pools, selected, num) : quoteSell(pools, selected, Math.min(num, held));
  }, [side, num, pools, selected, held]);

  const canTrade =
    ready && num > 0 && (side === "buy" ? num <= state.cash : num <= held + 1e-9) && market.status === "open";

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  function execute() {
    if (!canTrade || !quote) return;
    const label = market.outcomes[selected].label;
    if (side === "buy") {
      buy(slug, selected, num);
      flash(`Bought ${fmtUsd(quote.amountOut, 1)} "${label}" for ${fmtUsd(num, 0)} USDG`);
    } else {
      sell(slug, selected, num);
      flash(`Sold ${fmtUsd(num, 1)} "${label}" for ~${fmtUsd(quote.amountOut, 2)} USDG`);
    }
  }

  return (
    <aside className="card sticky top-24 h-fit p-5">
      <div className="eyebrow mb-3">Paper trade · demo USDG</div>

      {/* outcome selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {market.outcomes.map((o, i) => (
          <button
            key={o.id}
            onClick={() => onSelect(i)}
            className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
              i === selected
                ? "border-up-500/60 bg-up-500/10 text-up-300"
                : "border-line text-moss hover:text-paper"
            }`}
          >
            {o.label} · {fmtCents(probs[i])}
          </button>
        ))}
      </div>

      {/* buy / sell tabs */}
      <div className="mb-4 flex gap-2 rounded-xl bg-ink-900/70 p-1">
        <button className={`tab ${side === "buy" ? "active-buy" : ""}`} onClick={() => setSide("buy")}>
          Buy
        </button>
        <button className={`tab ${side === "sell" ? "active-sell" : ""}`} onClick={() => setSide("sell")}>
          Sell
        </button>
      </div>

      <label className="mb-1 block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-moss">
        {side === "buy" ? "Spend (USDG)" : "Sell (shares)"}
      </label>
      <input
        className="field"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder="100"
      />
      <div className="mt-2 flex gap-2">
        {(side === "buy" ? [50, 100, 500] : [held * 0.25, held * 0.5, held]).map((v, i) => (
          <button
            key={i}
            className="flex-1 rounded-lg border border-line py-1 font-mono text-xs text-moss hover:border-up-500/50 hover:text-paper"
            onClick={() => setAmount(String(Math.floor(v * 100) / 100))}
          >
            {side === "buy" ? `$${v}` : i === 2 ? "max" : `${(i + 1) * 25}%`}
          </button>
        ))}
      </div>

      {/* quote */}
      <div className="mt-4">
        <div className="stat-row">
          <span className="k">{side === "buy" ? "You receive" : "You get back"}</span>
          <span className="v text-up-300">
            {quote ? fmtUsd(quote.amountOut, 2) : "—"} {side === "buy" ? "shares" : "USDG"}
          </span>
        </div>
        <div className="stat-row">
          <span className="k">Avg price</span>
          <span className="v">{quote ? fmtCents(quote.avgPrice) : "—"}</span>
        </div>
        {side === "buy" && (
          <div className="stat-row">
            <span className="k">Pays if it wins</span>
            <span className="v text-up-300">{quote ? `${fmtUsd(quote.amountOut, 2)} USDG` : "—"}</span>
          </div>
        )}
        <div className="stat-row">
          <span className="k">Fee (2%)</span>
          <span className="v">{quote ? `${fmtUsd(quote.fee, 2)} USDG` : "—"}</span>
        </div>
        <div className="stat-row">
          <span className="k">New probability</span>
          <span className="v">{quote ? `${(quote.newProbability * 100).toFixed(1)}%` : "—"}</span>
        </div>
      </div>

      <button className="btn btn-primary mt-4 w-full" disabled={!canTrade} onClick={execute}>
        {side === "buy"
          ? `Buy ${market.outcomes[selected].label}`
          : `Sell ${market.outcomes[selected].label}`}
      </button>

      <div className="mt-3 flex items-center justify-between font-mono text-[0.7rem] text-moss">
        <span>cash: {fmtUsd(state.cash, 0)} USDG</span>
        <span>
          held: {fmtUsd(held, 1)} {market.outcomes[selected].label}
        </span>
      </div>

      <p className="mt-4 border-t border-line pt-3 text-[0.72rem] leading-relaxed text-moss/70">
        Demo only — same AMM math as the contracts, no real funds. Fees split 70% LPs / 10% creator
        / 20% treasury; this market's creator cut goes to the House Pool.
      </p>

      {toast && <div className="toast">{toast}</div>}
    </aside>
  );
}
