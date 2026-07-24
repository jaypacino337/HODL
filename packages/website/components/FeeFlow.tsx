import { FEE_SPLIT, TRADE_FEE } from "@overbid/shared";

/** The money diagram: where every trading fee goes, and why. */
export function FeeFlow() {
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr,2fr]">
      <div className="card flex flex-col justify-center gap-3 p-6">
        <div className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-moss">Every trade pays</div>
        <div className="display text-5xl text-up-400">{pct(TRADE_FEE)}</div>
        <p className="text-sm leading-relaxed text-moss">
          taken in USDG on each buy and sell, then split three ways — on-chain, every time, by the
          market contract itself.
        </p>
        <div className="mt-2 rounded-xl border border-paddle-400/30 bg-paddle-400/5 p-3 text-sm leading-relaxed text-paddle-300">
          The five launch markets are protocol-created, so their <b>creator cut flows back into the
          House Pool</b> — creator fees fund the liquidity that makes the board tradable.
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card flex flex-col p-6">
          <div className="display text-3xl text-up-400">{pct(FEE_SPLIT.lp)}</div>
          <h3 className="display mt-1 text-base">House Pool LPs</h3>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            The capital that seeds every market and eats the market risk when the crowd is right.
            Most of the fee belongs to it — plus settlement residuals sweep home to the pool.
          </p>
        </div>
        <div className="card flex flex-col p-6">
          <div className="display text-3xl text-paddle-400">{pct(FEE_SPLIT.creator)}</div>
          <h3 className="display mt-1 text-base">Market creators</h3>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            Launch a market from an approved template and earn this cut on its volume — data source
            pre-vetted, settlement rule locked at creation.
          </p>
        </div>
        <div className="card flex flex-col p-6">
          <div className="display text-3xl text-moss">{pct(FEE_SPLIT.treasury)}</div>
          <h3 className="display mt-1 text-base">Protocol treasury</h3>
          <p className="mt-2 text-sm leading-relaxed text-moss">
            Seeds new markets, pays oracle and index-licensing costs, and funds the early
            points/rewards program.
          </p>
        </div>
      </div>
    </div>
  );
}
