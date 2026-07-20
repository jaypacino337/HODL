const steps = [
  {
    step: "01",
    title: "Trade on pump.fun",
    body: "$ARROW launches on pump.fun's bonding curve like any other coin — buy and sell freely, no lockups.",
  },
  {
    step: "02",
    title: "Fees get harvested",
    body: "Every cycle, Sherwood's fee harvester claims the creator-fee share pump.fun accrues from trading activity.",
  },
  {
    step: "03",
    title: "Split: LP + rewards",
    body: "Harvested SOL is split automatically — half compounds into the ARROW/SOL liquidity pool, half funds the holder rewards vault.",
  },
  {
    step: "04",
    title: "Snapshot & airdrop",
    body: "Every 15 minutes, the bot snapshots every wallet's balance and airdrops the rewards vault out pro-rata. No claiming, no clicking.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 max-w-2xl">
        <h2 className="section-heading text-2xl font-bold sm:text-3xl">How the mechanism works</h2>
        <p className="mt-2 text-white/50">
          Four automated steps, running on a loop, entirely on-chain and independently verifiable.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.step} className="glass-card relative rounded-2xl p-6">
            <span className="font-display text-4xl font-bold text-white/10">{s.step}</span>
            <h3 className="mt-4 font-display text-lg font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
