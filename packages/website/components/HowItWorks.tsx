const STEPS = [
  {
    n: "01",
    title: "Fees fill the pot",
    body: "Every 15 minutes the game claims the token's pump.fun creator fees straight into the vault. Trading volume IS the prize pool — nobody deposits anything.",
  },
  {
    n: "02",
    title: "Hold 500K to play",
    body: "Anyone holding 500,000+ tokens can play every round, free. Your balance is your score: the more you hold, the bigger your share if you win.",
  },
  {
    n: "03",
    title: "Pick your case",
    body: "HODL or NO HODL. One signed message — no transaction, no gas. You can switch sides any time until the round locks, 30 seconds before the flip.",
  },
  {
    n: "04",
    title: "The flip pays out",
    body: "At the buzzer, a fresh Solana blockhash decides the winning side — verifiable by anyone. Winners split the whole pot pro-rata by their holdings, paid instantly in SOL. No winners? The pot rolls over and grows.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-5xl px-4 pb-20">
      <h2 className="text-center font-display text-4xl uppercase tracking-wide text-gold-metal">
        How it works
      </h2>
      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="panel p-6">
            <div className="font-display text-3xl text-ember-500">{s.n}</div>
            <div className="mt-2 font-display text-xl uppercase tracking-wide text-amber-50">
              {s.title}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-amber-100/70">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
