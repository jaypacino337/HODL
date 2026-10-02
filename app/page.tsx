"use client";

import { useState } from "react";
import { OutletBoard } from "@/components/OutletBoard";
import { SwapFlow } from "@/components/SwapFlow";
import { PLUGS, type PlugId } from "@/lib/plugs";

export default function Home() {
  const [plug, setPlug] = useState<PlugId>("empty");

  return (
    <>
      {/* nav */}
      <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur">
        <div className="wrap flex items-center justify-between py-3">
          <a href="#top" className="flex items-center gap-2.5">
            <svg viewBox="0 0 100 100" className="h-7 w-7" aria-hidden>
              <rect width="100" height="100" rx="22" fill="#151514" />
              <rect x="26" y="20" width="48" height="60" rx="12" fill="#F2EFE7" />
              <rect x="38" y="34" width="7" height="16" rx="2" fill="#151514" />
              <rect x="55" y="34" width="7" height="16" rx="2" fill="#151514" />
              <circle cx="50" cy="63" r="5" fill="#E85D04" />
            </svg>
            <span className="font-sans text-base font-extrabold tracking-tight">Outlet</span>
          </a>
          <nav className="hidden items-center gap-6 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-mute sm:flex">
            <a href="#swap" className="hover:text-ink">How it works</a>
            <a href="#rating" className="hover:text-ink">Permissions</a>
            <a href="#appliances" className="hover:text-ink">Appliances</a>
            <a href="#docs" className="hover:text-ink">Docs</a>
          </nav>
          <a href="#swap" className="btn btn-ink !py-2">
            Run a swap
          </a>
        </div>
      </header>

      <main id="top">
        {/* hero */}
        <section className="wrap pb-14 pt-14 sm:pt-20">
          <div className="max-w-3xl">
            <div className="eyebrow mb-3">A concentrated-liquidity AMM with one power socket per pool</div>
            <h1 className="font-sans text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              One outlet,
              <br />
              any appliance.
            </h1>
            <p className="mt-5 max-w-2xl text-[1.02rem] leading-relaxed text-mute">
              Outlet is a concentrated-liquidity AMM where every pool can take <b className="text-ink">one appliance
              program</b> that runs before and after swaps and liquidity changes — inside limits fixed when the pool is
              created. A dynamic fee, a TWAP oracle and range orders are built in. Anything else can be written as a new
              appliance instead of a new AMM.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#swap" className="btn btn-ink">Follow one swap</a>
              <a href="#docs" className="btn btn-line">Read how it works</a>
            </div>
          </div>

          <div className="mt-12">
            <OutletBoard plug={plug} onSelect={setPlug} />
          </div>
        </section>

        {/* scroll-driven swap */}
        <SwapFlow plug={plug} onSelect={setPlug} />

        {/* why */}
        <section className="wrap py-16" id="docs">
          <div className="eyebrow mb-2">Why an outlet</div>
          <h2 className="max-w-2xl font-sans text-2xl font-bold sm:text-3xl">
            Four ideas used to mean four AMMs. Here they mean four appliances.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              [
                "One program",
                "A new market-structure idea usually ships as its own AMM: new program, new liquidity, new audits, new integrations. On Outlet it ships as an appliance into pools that already exist.",
              ],
              [
                "One account shape",
                "Every pool lists its accounts the same way, appliance or not. A router or aggregator integrates once and reaches every pool — including ones running appliances written after the integration.",
              ],
              [
                "One failure rule",
                "Appliance calls run inside the swap's transaction. If a call fails, the whole swap reverts and nothing moves. Takers can't be left holding half a trade, and routers can route around the pool.",
              ],
            ].map(([h, b]) => (
              <div key={h} className="card p-6">
                <h3 className="font-sans text-lg font-bold">{h}</h3>
                <p className="mt-2 text-[0.85rem] leading-relaxed text-mute">{b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* permissions / the wall rating */}
        <section className="wrap py-16" id="rating">
          <div className="grid gap-8 lg:grid-cols-[1fr,1.2fr]">
            <div>
              <div className="eyebrow mb-2">Permissions</div>
              <h2 className="font-sans text-2xl font-bold sm:text-3xl">The wall sets the rating.</h2>
              <p className="mt-4 text-[0.92rem] leading-relaxed text-mute">
                An appliance can only draw what the socket is rated for. When a pool is created, its limits are fixed
                forever — which phases the appliance may hook, how far it may move the fee, how many accounts and how
                much compute it may add. The appliance can be upgraded by its author; <b className="text-ink">the
                rating can't be</b>. LPs read the rating once and know the worst case for the life of the pool.
              </p>
            </div>
            <div className="program p-6 sm:p-7">
              <div className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-dark-mute">Rated at pool creation · immutable</div>
              <div className="mt-4 space-y-0 font-mono text-[0.78rem]">
                {[
                  ["phases", "which of the six hook points may be called"],
                  ["fee override", "cap on any appliance-set fee, e.g. ≤ 1.00%"],
                  ["input surcharge", "cap on metered extras, e.g. ≤ 0.05%"],
                  ["accounts", "how many accounts the appliance may append"],
                  ["compute", "budget per call — overruns revert the swap"],
                  ["custody", "never. appliances cannot touch pool funds"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-6 border-b border-dark-line py-2.5 last:border-b-0">
                    <span className="uppercase tracking-[0.12em] text-[#E9E7DF]">{k}</span>
                    <span className="text-right text-[0.72rem] text-dark-mute">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* appliances */}
        <section className="wrap py-16" id="appliances">
          <div className="eyebrow mb-2">The first appliances</div>
          <h2 className="font-sans text-2xl font-bold sm:text-3xl">Plugged in on day one.</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PLUGS.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setPlug(p.id);
                  document.getElementById("swap")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="card p-5 text-left transition hover:-translate-y-0.5"
                style={{ borderTopColor: p.color, borderTopWidth: 2 }}
              >
                <div className="flex items-center gap-2">
                  <span className="plug-dot" style={{ background: p.color }} />
                  <h3 className="font-sans text-base font-bold">{p.name}</h3>
                </div>
                <p className="mt-2 text-[0.8rem] leading-relaxed text-mute">{p.blurb}</p>
                <div className="mt-3 font-mono text-[0.6rem] uppercase tracking-[0.14em]" style={{ color: p.color }}>
                  {p.phases.length} hook point{p.phases.length > 1 ? "s" : ""} · run it ↗
                </div>
              </button>
            ))}
          </div>
          <p className="mt-6 max-w-2xl font-mono text-[0.7rem] uppercase tracking-[0.14em] text-mute">
            An appliance is a program with six optional entrypoints. If you can write the idea, you can plug it in.
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="wrap flex flex-col items-start justify-between gap-4 py-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <span className="font-sans text-sm font-extrabold">Outlet</span>
            <span className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-mute">one outlet, any appliance</span>
          </div>
          <p className="max-w-md font-mono text-[0.62rem] uppercase leading-relaxed tracking-[0.12em] text-mute">
            Concept build — the protocol described here is a design, not a deployed program. Numbers on this page are
            worked examples, not live markets. Nothing here is investment advice.
          </p>
        </div>
      </footer>
    </>
  );
}
