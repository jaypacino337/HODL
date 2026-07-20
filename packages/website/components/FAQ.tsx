const faqs = [
  {
    q: "Is this affiliated with Robinhood Markets, Inc.?",
    a: "No. Sherwood Protocol is not affiliated with, endorsed by, or connected to Robinhood Markets, Inc. in any way. The name draws on the Robin Hood folklore theme — take from the trades, give to the holders — not the brokerage.",
  },
  {
    q: "Where do the rewards actually come from?",
    a: "From pump.fun's creator-fee sharing program, which pays the token's creator wallet a share of trading fees. Sherwood's harvester bot claims that automatically and splits it between liquidity and holder rewards instead of a person taking it home.",
  },
  {
    q: "Do I need to claim my airdrop?",
    a: "No. If you're holding at snapshot time and above the minimum eligible balance, SOL is sent directly to your wallet — no claim transaction, no visiting a dashboard.",
  },
  {
    q: "What determines my share?",
    a: "Your $ARROW balance divided by total eligible circulating supply at the moment of each 15-minute snapshot, multiplied by whatever's in the rewards vault at that time.",
  },
  {
    q: "Is this financial advice or a guaranteed return?",
    a: "No. $ARROW is a highly speculative token. Fee volume, and therefore rewards, can be zero in any given cycle. Nothing on this site is investment advice — see the full risk disclaimer below.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-4xl px-6 py-20">
      <div className="mb-10">
        <h2 className="section-heading text-2xl font-bold sm:text-3xl">FAQ</h2>
      </div>
      <div className="space-y-3">
        {faqs.map((f) => (
          <details key={f.q} className="glass-card group rounded-2xl px-6 py-4 open:pb-5">
            <summary className="cursor-pointer list-none font-medium text-white/85 marker:content-none">
              <span className="flex items-center justify-between">
                {f.q}
                <span className="ml-4 text-white/30 transition group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/55">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
