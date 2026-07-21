const STEPS = [
  {
    n: "01",
    title: "The box fills",
    body: "Every 15 minutes the game claims the token's pump.fun creator fees straight into the box. Trading volume IS the prize pool — nobody deposits anything.",
  },
  {
    n: "02",
    title: "Hold 1M to play",
    body: "Anyone holding 1,000,000+ tokens gets the call, every episode, free. Your balance is your score: the more you hold, the bigger your cut when you win.",
  },
  {
    n: "03",
    title: "Make the call",
    body: "HODL or NO HODL — stand with the holders or bet against the crowd. One signed message, no gas. Switch sides any time until picks seal, 30 seconds before the flip.",
  },
  {
    n: "04",
    title: "The box opens",
    body: "At the buzzer a fresh Solana blockhash decides the winning side — recomputable by anyone. Winners split the whole pot pro-rata by their bags, paid instantly in SOL. Nobody on the winning side? The pot rolls into the next episode and grows.",
  },
];

export function HowItWorks() {
  return (
    <section id="rules" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-20">
      <h2 className="anton gold-text text-center text-4xl">The Rules</h2>
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="panel p-6">
            <div className="anton red-text text-3xl">{s.n}</div>
            <div className="anton mt-2 text-xl text-cream">{s.title}</div>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-smoked">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
