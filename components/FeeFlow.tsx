"use client";

import { useEffect, useRef, useState } from "react";
import { ARCHETYPES, FEE_PRESETS, FEE_STAGES, type Archetype } from "@/lib/sentia";

/**
 * The scroll-driven fee. A tall pinned section walks one 1% trading fee from
 * the curve through the router's split — burn, fuel, creator — to the agent
 * actually doing its job. Captions and numbers re-wire live when the reader
 * switches archetype or fee preset. sticky + rAF, no animation deps.
 */
export function FeeFlow({
  archetype,
  preset,
  onArchetype,
}: {
  archetype: Archetype;
  preset: string;
  onArchetype: (a: Archetype) => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const a = ARCHETYPES[archetype];
  const split = FEE_PRESETS.find((p) => p.id === preset) ?? FEE_PRESETS[0];

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = sectionRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        setProgress(total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const N = FEE_STAGES.length;
  const stage = Math.min(N - 1, Math.floor(progress * N));
  const intra = Math.min(1, Math.max(0, progress * N - stage));
  const stageState = (i: number) => (i < stage ? "done" : i === stage ? "active" : "idle");

  // the example trade: 1,000 USDC buy → 1% fee = $10
  const FEE = 10;
  const pots = [
    { k: "burn", label: "burn $SENTIA", amt: (FEE * split.burn) / 100, color: "#F2B705", at: 2 },
    { k: "fuel", label: a.fuelLabel.toLowerCase(), amt: (FEE * split.fuel) / 100, color: a.color, at: 3 },
    { k: "creator", label: "creator", amt: (FEE * split.creator) / 100, color: "#F0EEEA", at: 4 },
    { k: "pad", label: "the pad", amt: (FEE * split.pad) / 100, color: "#55545c", at: 4 },
  ];

  return (
    <section ref={sectionRef} className="relative" style={{ height: "400vh", ["--arch" as string]: a.color }} id="fees">
      <div className="sticky top-0 flex min-h-screen flex-col justify-center py-10">
        <div className="wrap">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow mb-1.5">Follow one fee</div>
              <h2 className="font-sans text-2xl font-extrabold sm:text-3xl">
                A $1,000 buy pays $10. <span className="text-fog">Scroll to route it.</span>
              </h2>
            </div>
            <div className="flex gap-2">
              {Object.values(ARCHETYPES).map((arch) => (
                <button
                  key={arch.id}
                  onClick={() => onArchetype(arch.id)}
                  className="rounded-full border px-4 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] transition"
                  style={{
                    borderColor: archetype === arch.id ? arch.color : "rgba(240,238,234,0.2)",
                    color: archetype === arch.id ? arch.color : "#8E8D95",
                  }}
                >
                  {arch.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
            {/* the pipeline panel */}
            <div className="panel p-5 sm:p-7">
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
                {FEE_STAGES.map((st, i) => (
                  <div key={st.label} className="flex items-center gap-2">
                    <div className="stage-node w-full text-center sm:w-auto" data-state={stageState(i)}>
                      {st.label}
                    </div>
                    {i < N - 1 && (
                      <svg width="20" height="8" className="hidden shrink-0 sm:block" aria-hidden>
                        <line x1="0" y1="4" x2="20" y2="4" strokeWidth="2"
                          stroke={i < stage ? a.color : "rgba(240,238,234,0.18)"}
                          className={i === stage - 1 || i === stage ? "wire" : ""} />
                      </svg>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${progress * 100}%`, background: a.color }} />
              </div>

              <div className="mt-6 min-h-[170px] sm:min-h-[140px]">
                {FEE_STAGES.map((st, i) => (
                  <div key={i} style={{ display: i === stage ? "block" : "none" }}>
                    <div className="font-mono text-[0.66rem] uppercase tracking-[0.2em]" style={{ color: a.color }}>
                      {String(i + 1).padStart(2, "0")} / {String(N).padStart(2, "0")} · {st.label}
                    </div>
                    <h3 className="mt-2 font-sans text-xl font-extrabold text-chalk sm:text-2xl">
                      {st.title || a.fuelLabel}
                    </h3>
                    <p className="mt-2 max-w-xl text-[0.86rem] leading-relaxed text-fog">{st.body(a, split)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* the live pots */}
            <aside className="card p-5 sm:p-6">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-fog">one fee · $10.00</span>
                <span className="rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em]" style={{ borderColor: a.color, color: a.color }}>
                  {a.label}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {pots.map((p) => {
                  const lit = stage >= p.at;
                  const fill = stage > p.at ? 1 : stage === p.at ? intra : 0;
                  return (
                    <div key={p.k} style={{ opacity: lit ? 1 : 0.3, transition: "opacity .4s" }}>
                      <div className="flex items-baseline justify-between font-mono text-[0.68rem]">
                        <span className="uppercase tracking-[0.12em] text-fog">{p.label}</span>
                        <span className="tick text-chalk">${(p.amt * fill).toFixed(2)}</span>
                      </div>
                      <div className="split-bar mt-1 !h-1.5">
                        <div style={{ width: `${(p.amt / 10) * 100 * fill}%`, background: p.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="rule-h my-4" />
              <div className="font-mono text-[0.68rem] leading-relaxed text-fog">
                {stage >= 5 ? (
                  <span style={{ color: a.color }}>
                    ▸ agent {a.acts[Math.min(2, Math.floor(intra * 3))]}
                  </span>
                ) : (
                  "agent idle — fees still routing"
                )}
              </div>
              <p className="mt-3 text-[0.68rem] leading-relaxed text-fog">
                Worked example with the {split.name} route. Change the route in the launch desk above — this page
                recomputes.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
