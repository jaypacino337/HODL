import Link from "next/link";
import { LAUNCH_MARKETS, TOTAL_SEED_USD } from "@overbid/shared";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarketCard } from "@/components/MarketCard";
import { Ticker } from "@/components/Ticker";
import { FeeFlow } from "@/components/FeeFlow";
import { FAQ } from "@/components/FAQ";

export default function Home() {
  return (
    <>
      <Navbar />
      <Ticker />

      {/* ── hero ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center md:pt-24">
        <div className="chip mx-auto mb-6">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up-500" />
          Live demo · 5 protocol-funded markets · built for Robinhood Chain
        </div>
        <h1 className="display mx-auto max-w-3xl text-4xl leading-[1.05] md:text-6xl">
          Trade where <span className="text-up-500">housing</span> goes next.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-moss">
          OVERBID is a real-estate prediction market. Every outcome — <i>Miami beats New York</i>,{" "}
          <i>Austin tops Phoenix</i>, <i>Manhattan rents print green</i> — is a share you can buy
          and sell. When the housing index settles, winning shares redeem the collateral.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/#markets" className="btn btn-primary">
            Trade the launch board
          </Link>
          <Link href="/pool" className="btn btn-ghost">
            Provide liquidity
          </Link>
        </div>
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["5", "launch markets, funded by us"],
            [`$${(TOTAL_SEED_USD / 1000).toFixed(0)}K`, "House Pool seed liquidity"],
            ["2%", "trade fee — 70% to LPs"],
            ["USDG", "collateral, dollar-settled"],
          ].map(([v, k]) => (
            <div key={k} className="card px-4 py-4">
              <div className="display text-2xl text-up-400">{v}</div>
              <div className="mt-1 text-xs text-moss">{k}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── markets board ────────────────────────────────────────────── */}
      <section id="markets" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-2">The launch board</div>
            <h2 className="display text-3xl">Five markets. Funded by the protocol.</h2>
            <p className="mt-2 max-w-xl text-sm text-moss">
              Created from approved templates, seeded with ${(TOTAL_SEED_USD / 1000).toFixed(0)}K of
              House Pool liquidity, settled against Parcl Labs housing indexes. Their creator-fee cut
              routes straight back into the pool.
            </p>
          </div>
          <span className="chip">prices = implied probability · 1 winning share → 1 USDG</span>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {LAUNCH_MARKETS.map((m) => (
            <MarketCard key={m.slug} market={m} />
          ))}
          <div className="card flex flex-col items-start justify-center gap-3 border-dashed p-6">
            <div className="chip">Coming next</div>
            <h3 className="display text-lg">Launch your own market</h3>
            <p className="text-sm leading-relaxed text-moss">
              Pick an approved template (city race, head-to-head, over/under), seed it with USDG, and
              earn the 10% creator cut of every trade it clears. Templates keep every market
              objectively settleable from licensed index data.
            </p>
          </div>
        </div>
      </section>

      {/* ── how it works ─────────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
        <div className="eyebrow mb-2">How it works</div>
        <h2 className="display mb-8 text-3xl">From USDG to settlement</h2>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            [
              "01 · Fund",
              "Bring USDG",
              "Markets are collateralized in USDG, the Global Dollar. Every complete set of outcome shares is backed 1:1 — no house edge hidden in the odds.",
            ],
            [
              "02 · Trade",
              "Buy city outcomes",
              "An on-chain fixed-product AMM prices every outcome continuously. A 62¢ share means the market says 62%. Sell any time before the market locks.",
            ],
            [
              "03 · Settle",
              "Indexes decide",
              "At window end the oracle reads the housing index — e.g. which city's price feed gained the most percent. No juries, no vibes: licensed data settles it.",
            ],
            [
              "04 · Redeem",
              "Winners collect",
              "Winning shares redeem 1 USDG each straight from market collateral. Residual AMM inventory sweeps home to the House Pool that took the risk.",
            ],
          ].map(([step, title, body]) => (
            <div key={step} className="card p-5">
              <div className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-up-500">{step}</div>
              <h3 className="display mt-2 text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-moss">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── economics ────────────────────────────────────────────────── */}
      <section id="economics" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
        <div className="eyebrow mb-2">Economics</div>
        <h2 className="display mb-3 text-3xl">LP shares, not a governance token.</h2>
        <p className="mb-8 max-w-2xl text-sm leading-relaxed text-moss">
          No token whose holders skim revenue for nothing. The people who get a piece of OVERBID are
          the people funding it: House Pool LPs put up the capital that makes markets tradable, so
          they earn most of the fees — and carry the market risk that justifies them.
        </p>
        <FeeFlow />
      </section>

      {/* ── tech ─────────────────────────────────────────────────────── */}
      <section id="tech" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
        <div className="eyebrow mb-2">The tech play</div>
        <h2 className="display mb-8 text-3xl">Built for Robinhood Chain.</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-6">
            <h3 className="display text-lg text-up-400">Robinhood Chain, day one</h3>
            <p className="mt-2 text-sm leading-relaxed text-moss">
              OVERBID's contracts target Robinhood Chain — the Arbitrum Orbit L2 built for
              real-world assets. Standard EVM, so everything runs unchanged on Arbitrum Sepolia
              today and redeploys the moment the public RPC opens. Retail rails, tokenized-asset
              DNA, and a stablecoin (USDG) already in the family: exactly where a housing market
              wants to live.
            </p>
          </div>
          <div className="card p-6">
            <h3 className="display text-lg text-up-400">Licensed index data</h3>
            <p className="mt-2 text-sm leading-relaxed text-moss">
              Settlement reads Parcl Labs price feeds — daily, US-market coverage, an API built for
              exactly this. Miami, New York, Austin, Phoenix, Chicago and the national aggregate are
              live in v1. Toronto and other non-US cities wait on a licensed local index provider
              behind the same oracle interface — we don't list a market we can't settle.
            </p>
          </div>
          <div className="card p-6">
            <h3 className="display text-lg text-up-400">Four small contracts</h3>
            <p className="mt-2 text-sm leading-relaxed text-moss">
              <b className="text-paper">OverbidMarket</b> (n-outcome fixed-product AMM, complete-set
              collateral), <b className="text-paper">HousePool</b> (LP vault),{" "}
              <b className="text-paper">MarketFactory</b> (approved templates only),{" "}
              <b className="text-paper">IndexOracle</b> (auditable on-chain index ledger). The demo
              on this site runs the same AMM math the contracts do.
            </p>
          </div>
        </div>
      </section>

      {/* ── roadmap ──────────────────────────────────────────────────── */}
      <section id="roadmap" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
        <div className="eyebrow mb-2">Roadmap</div>
        <h2 className="display mb-8 text-3xl">Prediction markets first. Perps next.</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [
              "Now",
              "The launch board",
              "Five protocol-funded markets on US cities. Paper-trading demo live on this site; contracts on testnet. Points program for early traders and LPs.",
              true,
            ],
            [
              "Next",
              "Open creation + more cities",
              "Community market creation from approved templates with creator fees. More US metros as feeds prove out; non-US cities (Toronto first) as licensed index partners land.",
              false,
            ],
            [
              "Then",
              "OVERBID Perps",
              "Once index history, users and liquidity are deep enough: perpetual long/short markets on city indexes — funding-rate-balanced, House-Pool-backed. Trade the level, not just the race.",
              false,
            ],
          ].map(([tag, title, body, hot]) => (
            <div key={title as string} className={`card p-6 ${hot ? "border-up-500/40 shadow-glow-up" : ""}`}>
              <div className={`chip ${hot ? "border-up-500/50 text-up-400" : ""}`}>{tag}</div>
              <h3 className="display mt-3 text-lg">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-moss">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <FAQ />
      <Footer />
    </>
  );
}
