const phases = [
  {
    title: "Phase 1 — Sherwood awakens",
    items: ["Launch $ARROW on pump.fun", "Deploy the fee-harvester + snapshot bot", "Publish this site + open-source repo"],
  },
  {
    title: "Phase 2 — The bow is drawn",
    items: [
      "Graduate to PumpSwap / Raydium liquidity",
      "Turn on auto-LP compounding",
      "First public 15-minute snapshot cycle",
    ],
  },
  {
    title: "Phase 3 — Sherwood forest grows",
    items: ["Public dashboard of every historical snapshot", "Holder leaderboard", "Community-proposed LP/rewards split votes"],
  },
];

export default function Roadmap() {
  return (
    <section id="roadmap" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 max-w-2xl">
        <h2 className="section-heading text-2xl font-bold sm:text-3xl">Roadmap</h2>
        <p className="mt-2 text-white/50">Directional, not a promise — the mechanism shipping is the real roadmap.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {phases.map((p, i) => (
          <div key={p.title} className="glass-card rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sherwood-400/15 text-xs font-bold text-sherwood-300">
                {i + 1}
              </span>
              <h3 className="font-display text-base font-semibold">{p.title}</h3>
            </div>
            <ul className="space-y-2 text-sm text-white/60">
              {p.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 text-sherwood-400">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
