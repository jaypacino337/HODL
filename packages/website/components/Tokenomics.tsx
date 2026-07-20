const allocation = [
  { label: "Bonding curve / public trading", pct: 100, color: "bg-sherwood-400" },
];

const flow = [
  { label: "Liquidity pool", pct: 50, color: "bg-sherwood-400", note: "auto-compounded every cycle" },
  { label: "Holder rewards", pct: 50, color: "bg-gold-500", note: "airdropped every 15 minutes" },
];

export default function Tokenomics() {
  return (
    <section id="tokenomics" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 max-w-2xl">
        <h2 className="section-heading text-2xl font-bold sm:text-3xl">Tokenomics</h2>
        <p className="mt-2 text-white/50">
          No presale, no team allocation, no vesting cliffs. 100% of supply enters circulation through the public
          bonding curve — the only "tax" is what pump.fun already takes as a trading fee, and Sherwood just makes
          sure the creator's share of it comes back to holders.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="font-display text-lg font-semibold">Supply distribution</h3>
          <div className="mt-6 space-y-4">
            {allocation.map((a) => (
              <div key={a.label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-white/70">{a.label}</span>
                  <span className="font-medium text-white">{a.pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div className={`h-full rounded-full ${a.color}`} style={{ width: `${a.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-white/35">
            1,000,000,000 $ARROW total supply. Fixed at launch — the mint authority is revoked once trading opens.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <h3 className="font-display text-lg font-semibold">Where harvested fees go</h3>
          <div className="mt-6 space-y-4">
            {flow.map((f) => (
              <div key={f.label}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-white/70">{f.label}</span>
                  <span className="font-medium text-white">{f.pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div className={`h-full rounded-full ${f.color}`} style={{ width: `${f.pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-white/35">{f.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-white/35">
            The LP / rewards split is a governable parameter (<code>LP_SHARE</code>), not a fixed promise — check the
            protocol repo for the current on-chain configuration.
          </p>
        </div>
      </div>
    </section>
  );
}
