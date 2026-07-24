"use client";

import { useState } from "react";
import Link from "next/link";
import { LAUNCH_MARKETS, TOTAL_SEED_USD } from "@overbid/shared";
import { useDemoCtx } from "@/lib/DemoContext";
import { POOL_BASE_TVL, totalFees } from "@/lib/store";
import { fmtUsd } from "@/lib/format";

export function PoolView() {
  const { state, ready, depositLp, withdrawLp, reset } = useDemoCtx();
  const [amount, setAmount] = useState("1000");
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [toast, setToast] = useState<string | null>(null);

  const fees = totalFees(state);
  const tvl = POOL_BASE_TVL + state.lpDeposited + fees.lp + fees.creator; // creator cut of protocol markets returns to pool
  const yourShare = tvl > 0 ? state.lpDeposited / tvl : 0;
  const num = Number(amount) || 0;
  const can =
    ready && num > 0 && (mode === "deposit" ? num <= state.cash : num <= state.lpDeposited);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  function execute() {
    if (!can) return;
    if (mode === "deposit") {
      depositLp(num);
      flash(`Deposited ${fmtUsd(num, 0)} USDG into the House Pool`);
    } else {
      withdrawLp(num);
      flash(`Withdrew ${fmtUsd(num, 0)} USDG from the House Pool`);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <div className="max-w-2xl">
        <div className="eyebrow mb-2">House Pool</div>
        <h1 className="display text-4xl">The capital behind every market.</h1>
        <p className="mt-3 leading-relaxed text-moss">
          LPs deposit USDG and receive <b className="text-paper">ovLP</b> shares. The pool seeds new
          markets (it funded all five launch markets), earns <b className="text-up-400">70% of every
          trading fee</b>, collects settlement residuals — and, because the launch markets are
          protocol-created, their 10% creator cut too. In exchange, LPs carry market risk: when
          traders are right, payouts come out of pool-seeded collateral.
        </p>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[2fr,1.2fr]">
        <div className="flex flex-col gap-4">
          {/* stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [`$${fmtUsd(tvl, 0)}`, "pool TVL (demo)"],
              [`$${fmtUsd(TOTAL_SEED_USD, 0)}`, "deployed as market seeds"],
              [`$${fmtUsd(fees.lp + fees.creator, 2)}`, "fees accrued to pool"],
              [`${(yourShare * 100).toFixed(2)}%`, "your share"],
            ].map(([v, k]) => (
              <div key={k} className="card px-4 py-4">
                <div className="display text-xl text-up-400">{v}</div>
                <div className="mt-1 text-xs text-moss">{k}</div>
              </div>
            ))}
          </div>

          {/* where yield comes from */}
          <div className="card p-6">
            <div className="eyebrow mb-4">Where the yield comes from</div>
            <div className="space-y-4 text-sm leading-relaxed text-moss">
              <p>
                <b className="text-paper">1 · Trading fees.</b> Every buy and sell on every market
                pays 2%; 70% of it lands here, pro-rata to ovLP. The creator cut of
                protocol-launched markets (all five on the launch board) lands here too.
              </p>
              <p>
                <b className="text-paper">2 · Settlement residuals.</b> When a market resolves, the
                AMM's leftover winning-outcome inventory converts to USDG and sweeps back to the
                pool.
              </p>
              <p>
                <b className="text-paper">3 · The risk that pays for it.</b> Seeded markets can lose
                money when the crowd prices outcomes better than the AMM. That is the trade: LPs are
                the house, fees are the rake, variance is real. Not a savings account.
              </p>
            </div>
          </div>

          {/* seeded markets */}
          <div className="card p-6">
            <div className="eyebrow mb-4">Markets this pool has seeded</div>
            <div className="space-y-2">
              {LAUNCH_MARKETS.map((m) => (
                <Link
                  key={m.slug}
                  href={`/markets/${m.slug}`}
                  className="flex items-center justify-between rounded-lg border border-line px-4 py-3 text-sm transition hover:border-up-500/50"
                >
                  <span className="font-semibold text-paper">{m.question}</span>
                  <span className="font-mono text-xs text-moss">${fmtUsd(m.seedLiquidityUsd, 0)} seed</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* deposit / withdraw */}
        <aside className="card sticky top-24 h-fit p-5">
          <div className="eyebrow mb-3">Demo LP position</div>
          <div className="mb-4 flex gap-2 rounded-xl bg-ink-900/70 p-1">
            <button className={`tab ${mode === "deposit" ? "active-buy" : ""}`} onClick={() => setMode("deposit")}>
              Deposit
            </button>
            <button className={`tab ${mode === "withdraw" ? "active-sell" : ""}`} onClick={() => setMode("withdraw")}>
              Withdraw
            </button>
          </div>
          <label className="mb-1 block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-moss">
            Amount (USDG)
          </label>
          <input
            className="field"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <div className="mt-4">
            <div className="stat-row">
              <span className="k">Your deposit</span>
              <span className="v">{fmtUsd(state.lpDeposited, 0)} USDG</span>
            </div>
            <div className="stat-row">
              <span className="k">Cash</span>
              <span className="v">{fmtUsd(state.cash, 0)} USDG</span>
            </div>
            <div className="stat-row">
              <span className="k">Fee share (70% + creator)</span>
              <span className="v text-up-300">${fmtUsd((fees.lp + fees.creator) * yourShare, 4)}</span>
            </div>
          </div>
          <button className="btn btn-primary mt-4 w-full" disabled={!can} onClick={execute}>
            {mode === "deposit" ? "Deposit USDG" : "Withdraw USDG"}
          </button>
          <p className="mt-4 border-t border-line pt-3 text-[0.72rem] leading-relaxed text-moss/70">
            Demo balances only. On-chain, deposits mint ovLP via HousePool.sol and withdrawals burn
            them at the pool's live share price.
          </p>
          <button
            className="mt-3 w-full rounded-lg border border-line py-2 font-mono text-xs text-moss hover:border-down-500/50 hover:text-down-400"
            onClick={() => {
              reset();
              flash("Demo reset — fresh 10,000 USDG");
            }}
          >
            reset entire demo
          </button>
          {toast && <div className="toast">{toast}</div>}
        </aside>
      </div>
    </main>
  );
}
