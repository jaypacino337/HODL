"use client";

import { useState } from "react";
import { LaunchDemo, type LaunchState } from "@/components/LaunchDemo";
import { FeeFlow } from "@/components/FeeFlow";
import { ARCHETYPES, EXAMPLE_ROSTER } from "@/lib/sentia";

export default function Home() {
  const [s, setS] = useState<LaunchState>({ archetype: "influencer", name: "", dial: 1, preset: "balanced", launched: false });
  const set = (patch: Partial<LaunchState>) => setS((prev) => ({ ...prev, ...patch }));

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-studio/85 backdrop-blur">
        <div className="wrap flex items-center justify-between py-3">
          <a href="#top" className="flex items-center gap-2.5">
            <svg viewBox="0 0 100 100" className="h-7 w-7" aria-hidden>
              <rect width="100" height="100" rx="22" fill="#0E0E11" stroke="rgba(240,238,234,0.2)" />
              <path d="M66 30 C58 22 34 22 34 38 C34 50 50 50 50 50" fill="none" stroke="#FF4D8D" strokeWidth="9" strokeLinecap="round" />
              <path d="M50 50 C50 50 66 50 66 62 C66 78 42 78 34 70" fill="none" stroke="#3DF08C" strokeWidth="9" strokeLinecap="round" />
            </svg>
            <span className="font-sans text-base font-extrabold tracking-tight">
              Sen<span className="text-sign">tia</span>
            </span>
          </a>
          <nav className="hidden items-center gap-6 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-fog sm:flex">
            <a href="#launch" className="hover:text-chalk">Launch</a>
            <a href="#fees" className="hover:text-chalk">Fees</a>
            <a href="#roster" className="hover:text-chalk">Roster</a>
            <a href="#docs" className="hover:text-chalk">Docs</a>
          </nav>
          <a href="#launch" className="btn btn-sign !py-2">Launch an AI</a>
        </div>
      </header>

      <main id="top">
        {/* hero */}
        <section className="wrap pb-6 pt-14 sm:pt-20">
          <div className="max-w-3xl">
            <div className="eyebrow mb-3">Sentia · AI agents with their own token · concept preview</div>
            <h1 className="font-sans text-[2.5rem] font-black leading-[1.02] tracking-tight sm:text-6xl">
              Launch an AI influencer.
              <br />
              <span className="text-trade">Or one that trades.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[1.02rem] leading-relaxed text-fog">
              Describe your agent in one sentence. It launches with its own token, and every trade&apos;s fee goes to work:{" "}
              <b className="text-burn">burning $SENTIA</b>,{" "}
              <b className="text-chalk">fueling the agent</b> — video renders for influencers, bankroll for traders —
              and <b className="text-chalk">paying you</b>. You set it up; the agent runs itself.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#launch" className="btn btn-sign">Sign your first talent</a>
              <a href="#fees" className="btn btn-line">Follow one fee</a>
            </div>
          </div>

          {/* roster tape */}
          <div className="mt-10 flex flex-wrap items-center gap-2" aria-label="example tickers">
            <span className="mr-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-fog">examples:</span>
            {EXAMPLE_ROSTER.map((r) => (
              <span key={r.ticker} className="ticker-chip">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: ARCHETYPES[r.archetype].color }} />
                ${r.ticker}
              </span>
            ))}
            <span className="ticker-chip !border-dashed">your agent →</span>
          </div>
        </section>

        {/* launch desk */}
        <section className="wrap py-14" id="launch">
          <div className="mb-6">
            <div className="eyebrow mb-1.5">The launch desk</div>
            <h2 className="font-sans text-2xl font-extrabold sm:text-3xl">Three steps. Try it right here.</h2>
          </div>
          <LaunchDemo s={s} set={set} />
        </section>

        {/* scroll-driven fee */}
        <FeeFlow archetype={s.archetype} preset={s.preset} onArchetype={(a) => set({ archetype: a })} />

        {/* roster */}
        <section className="wrap py-16" id="roster">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow mb-1.5">The roster</div>
              <h2 className="font-sans text-2xl font-extrabold sm:text-3xl">What a signed agent looks like.</h2>
            </div>
            <span className="rounded-full border border-burn/50 px-3 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-burn">
              example roster — no live launches yet
            </span>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLE_ROSTER.map((r) => {
              const arch = ARCHETYPES[r.archetype];
              return (
                <div key={r.ticker} className="card card-hover p-5" style={{ ["--arch" as string]: arch.color, borderTopColor: arch.color, borderTopWidth: 2 }}>
                  <div className="flex items-center gap-3">
                    <div className="avatar !h-11 !w-11 !text-base">{r.name.slice(0, 1)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-sans text-base font-extrabold">{r.name}</div>
                      <div className="font-mono text-[0.62rem] uppercase tracking-[0.14em]" style={{ color: arch.color }}>
                        ${r.ticker} · {arch.tag} · {r.dial}
                      </div>
                    </div>
                    <span className="self-start rounded border border-chalk/15 px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-fog">
                      example
                    </span>
                  </div>
                  <p className="mt-2.5 text-[0.76rem] leading-relaxed text-fog">{r.note}</p>
                  <div className="rule-h my-3" />
                  <div className="flex justify-between font-mono text-[0.68rem] text-chalk">
                    <span>{r.stat1}</span>
                    <span className="text-fog">{r.stat2}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* rules / docs */}
        <section className="wrap py-14" id="docs">
          <div className="eyebrow mb-1.5">House rules · as designed</div>
          <h2 className="max-w-2xl font-sans text-2xl font-extrabold sm:text-3xl">A launchpad for agents, not a casino of mystery boxes.</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["Fees are the only product", "1% on curve trades. The route — burn / fuel / creator / pad — is fixed at launch and public forever. Nobody can quietly re-point it, including us."],
              ["Agents are labeled", "Every influencer is marked AI on every platform it posts to. Every trader's positions, PnL and risk caps are public pages, not screenshots."],
              ["Fuel is escrowed", "The agent's fee share sits in its own program account and can only pay compute invoices or fund the capped bankroll. Creators can't drain the fuel tank."],
              ["Risk caps are hard", "Traders launch with a bankroll ceiling, per-trade size and a drawdown kill-switch. Hitting the switch halts trading until holders vote to restart."],
            ].map(([h, b]) => (
              <div key={h} className="card p-5">
                <h3 className="font-sans text-base font-extrabold">{h}</h3>
                <p className="mt-2 text-[0.78rem] leading-relaxed text-fog">{b}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="wrap flex flex-col items-start justify-between gap-4 py-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <span className="font-sans text-sm font-extrabold">
              Sen<span className="text-sign">tia</span>
            </span>
            <span className="font-mono text-[0.64rem] uppercase tracking-[0.16em] text-fog">AI that posts · AI that trades</span>
          </div>
          <p className="max-w-md font-mono text-[0.6rem] uppercase leading-relaxed tracking-[0.12em] text-fog">
            Concept build — no token, no launches, no live agents yet. The roster is a labeled example and every number
            is a worked illustration. Memecoins are volatile; nothing here is investment advice.
          </p>
        </div>
      </footer>
    </>
  );
}
