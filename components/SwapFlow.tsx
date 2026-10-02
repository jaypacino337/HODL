"use client";

import { useEffect, useRef, useState } from "react";
import { PLUGS, PLUG_BY_ID, SCENARIOS, STAGES, type PlugId } from "@/lib/plugs";

/**
 * The scroll-driven swap. A tall section pins its panel; scrolling advances
 * one swap of 40 SOL through the pipeline — router → accounts → before →
 * CLMM → after → settle — with the numbers and captions re-wired by whatever
 * appliance is plugged in. Hand-rolled (rAF + sticky): no animation deps.
 */
export function SwapFlow({ plug, onSelect }: { plug: PlugId; onSelect: (p: PlugId) => void }) {
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const scenario = SCENARIOS[plug];
  const active = plug !== "empty" ? PLUG_BY_ID[plug] : null;

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = sectionRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
        setProgress(p);
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

  const N = STAGES.length;
  const stage = Math.min(N - 1, Math.floor(progress * N));
  const intra = Math.min(1, Math.max(0, progress * N - stage));

  // tweened numbers
  const price =
    stage < 3 ? scenario.priceFrom : stage === 3 ? scenario.priceFrom + (scenario.priceTo - scenario.priceFrom) * intra : scenario.priceTo;
  const out = stage < 5 ? 0 : scenario.out * Math.min(1, intra * 2);

  const stageState = (i: number) => (i < stage ? "done" : i === stage ? "active" : "idle");

  const captions: Array<{ title: string; body: string }> = [
    {
      title: STAGES[0].title,
      body: "A router never needs to know which appliance a pool runs. It asks the pool for its account list and gets the same shape back from every Outlet pool.",
    },
    {
      title: STAGES[1].title,
      body: `This swap lists ${scenario.accounts} accounts${active ? ` — the plain ten plus the ${active.name.toLowerCase()}'s own` : " — the plain ten; the appliance list is empty"}. One integration reaches every pool, present and future.`,
    },
    { title: scenario.beforeTitle, body: scenario.beforeBody },
    { title: STAGES[3].title, body: scenario.clmmBody },
    { title: scenario.afterTitle, body: scenario.afterBody },
    { title: STAGES[5].title, body: scenario.settleNote },
  ];

  return (
    <section ref={sectionRef} className="relative" style={{ height: "420vh" }} id="swap">
      <div className="sticky top-0 flex min-h-screen flex-col justify-center py-10">
        <div className="wrap">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow mb-1.5">Follow one swap</div>
              <h2 className="font-sans text-2xl font-bold sm:text-3xl">
                40 SOL for USD. <span className="text-mute">Scroll to run it.</span>
              </h2>
            </div>
            {/* plug switcher stays live mid-animation */}
            <div className="flex flex-wrap gap-2">
              <button
                className="plug-chip"
                data-active={plug === "empty"}
                style={{ ["--plug" as string]: "#151514" }}
                onClick={() => onSelect("empty")}
              >
                empty
              </button>
              {PLUGS.map((p) => (
                <button
                  key={p.id}
                  className="plug-chip"
                  data-active={plug === p.id}
                  style={{ ["--plug" as string]: p.color }}
                  onClick={() => onSelect(p.id)}
                >
                  <span className="plug-dot" style={{ background: p.color }} />
                  {p.short}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr]">
            {/* the program panel */}
            <div className="program p-5 sm:p-7">
              {/* pipeline */}
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
                {STAGES.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className="stage-node w-full text-center sm:w-auto" data-state={stageState(i)}>
                      {s.label}
                    </div>
                    {i < N - 1 && (
                      <svg width="22" height="8" className="hidden shrink-0 sm:block" aria-hidden>
                        <line
                          x1="0"
                          y1="4"
                          x2="22"
                          y2="4"
                          stroke={i < stage ? "#E85D04" : "rgba(247,245,239,0.18)"}
                          strokeWidth="2"
                          className={i === stage - 1 || i === stage ? "wire" : ""}
                        />
                      </svg>
                    )}
                  </div>
                ))}
              </div>

              {/* progress rail */}
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-[rgba(247,245,239,0.1)]">
                <div
                  className="h-full rounded-full bg-current transition-[width] duration-150"
                  style={{ width: `${progress * 100}%`, color: "#E85D04" }}
                />
              </div>

              {/* captions */}
              <div className="mt-6 min-h-[180px] sm:min-h-[150px]">
                {captions.map((c, i) => (
                  <div key={i} className="caption-step" data-state={i === stage ? "active" : "idle"} style={{ display: i === stage ? "block" : "none" }}>
                    <div className="font-mono text-[0.66rem] uppercase tracking-[0.2em]" style={{ color: "#E85D04" }}>
                      {String(i + 1).padStart(2, "0")} / {String(N).padStart(2, "0")} · {STAGES[i].label}
                    </div>
                    <h3 className="mt-2 font-sans text-xl font-bold text-[#F7F5EF] sm:text-2xl">{c.title}</h3>
                    <p className="mt-2 max-w-xl text-[0.86rem] leading-relaxed text-[#B9B8B1]">{c.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* the live receipt */}
            <aside className="card p-5 sm:p-6">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-mute">Example swap · SOL/USD</span>
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.12em]"
                  style={{ borderColor: active ? active.color : "rgba(21,21,20,0.25)", color: active ? active.color : "#6e6d66" }}
                >
                  {active ? active.name : "no appliance"}
                </span>
              </div>
              <dl className="mt-4 space-y-0">
                {[
                  ["In", "40.000 SOL", 0],
                  ["Accounts", String(scenario.accounts), 1],
                  ["Before swap", plug === "empty" || plug === "twap" ? "no call" : "appliance call", 2],
                  ["Fee", `${scenario.feeLabel} · ${scenario.feeNote.split("·")[1]?.trim() ?? "pool"}`, 2],
                  ["Price", `${scenario.priceFrom.toFixed(2)} → ${price.toFixed(2)}`, 3],
                  ["After swap", plug === "empty" || plug === "dynamic-fee" ? "no call" : "appliance call", 4],
                  ["Out", out > 0 ? `${out.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD` : "—", 5],
                ].map(([k, v, at]) => {
                  const lit = stage >= (at as number);
                  return (
                    <div
                      key={k as string}
                      className="flex items-baseline justify-between border-b border-line py-2 last:border-b-0"
                      style={{ opacity: lit ? 1 : 0.28, transition: "opacity 0.4s" }}
                    >
                      <dt className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-mute">{k}</dt>
                      <dd className="tick font-mono text-[0.8rem] text-ink">{v}</dd>
                    </div>
                  );
                })}
              </dl>
              <div
                className="mt-4 rounded-md border px-3 py-2 text-center font-mono text-[0.66rem] uppercase tracking-[0.18em] transition-all duration-500"
                style={{
                  borderColor: stage >= 5 && intra > 0.5 ? "#2E7D4F" : "rgba(21,21,20,0.15)",
                  color: stage >= 5 && intra > 0.5 ? "#2E7D4F" : "#9a9992",
                }}
              >
                {stage >= 5 && intra > 0.5 ? "settled ✓" : "in flight"}
              </div>
              <p className="mt-3 text-[0.7rem] leading-relaxed text-mute">
                If any appliance call fails, the whole swap reverts — nothing moves, and the router can route around the
                pool.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
