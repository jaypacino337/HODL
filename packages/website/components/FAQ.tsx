const QA: Array<[string, string]> = [
  [
    "What exactly am I buying?",
    "A share of one outcome in one market — e.g. \"Miami\" in the 2026 city race. Prices are set by an automated market maker and equal the market's implied probability: a 29¢ share pays 1 USDG if Miami's index gains the most, or expires worthless if it doesn't. You can sell back to the market any time before it locks.",
  ],
  [
    "Who decides the winner?",
    "The index does. Each market names its data source and window up front — e.g. Parcl Labs price feeds, Jan 1 to Dec 31 2026, biggest percentage gain wins. The oracle posts the index values on-chain and resolves against them, so anyone can audit the settlement against the posted series.",
  ],
  [
    "Is there a token?",
    "No. The economic instrument is the House Pool LP share: deposit USDG, get ovLP, earn 70% of every trading fee plus settlement residuals — and carry the pool's market risk. People who provide the capital get the piece. A points program tracks early traders and LPs.",
  ],
  [
    "Why USDG and Robinhood Chain?",
    "The contracts are written for Robinhood Chain, the Arbitrum Orbit L2 aimed at retail and tokenized real-world assets, and settle in USDG (Global Dollar). Same EVM everywhere, so the code runs on Arbitrum testnets today and moves to Robinhood Chain's public rails as they open.",
  ],
  [
    "What about Toronto (and other non-US cities)?",
    "Parcl Labs covers US markets, which is why the launch board is US-only. Non-US cities need a licensed local index provider wired in behind the same oracle interface. We list markets only where we can settle them from licensed data — Toronto is on the list, waiting on its feed.",
  ],
  [
    "Is this live money right now?",
    "No. This site is a paper-trading demo: you get 10,000 demo USDG, the AMM is real (the exact math the contracts use) but nothing touches a chain and nothing has value. Contracts are unaudited reference code until an audit and the legal work say otherwise.",
  ],
];

export function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-14">
      <div className="eyebrow mb-2">FAQ</div>
      <h2 className="display mb-8 text-3xl">Questions people actually ask</h2>
      <div className="space-y-3">
        {QA.map(([q, a]) => (
          <details key={q} className="card group p-5 open:border-up-500/40">
            <summary className="display cursor-pointer list-none text-base text-paper marker:content-none">
              <span className="mr-2 font-mono text-up-500 transition group-open:rotate-90 inline-block">›</span>
              {q}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-moss">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
