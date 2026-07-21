const QA = [
  {
    q: "Does playing cost anything?",
    a: "No. A pick is just a signed message — no transaction, no gas, no deposit. The pot is funded entirely by the token's own trading fees.",
  },
  {
    q: "Where does the pot come from?",
    a: "pump.fun shares trading fees with a coin's creator. Every 15 minutes the game claims those creator fees into the vault, and that vault balance is the round's pot.",
  },
  {
    q: "How is the winning side decided?",
    a: "At settlement the game fetches a fresh finalized Solana blockhash and hashes it with the round number: an even first byte means HODL wins, odd means NO HODL. The blockhash is published with every round so anyone can recompute the flip.",
  },
  {
    q: "What exactly do winners get?",
    a: "The whole pot, split pro-rata by token balance. If you hold 2M tokens and all winners together hold 10M, you get 20% of the pot, paid in SOL straight to your wallet.",
  },
  {
    q: "What if I sell after picking?",
    a: "Balances are re-checked at the flip. Drop below 500K and your pick is voided; your remaining balance is what your share is computed from. Diamond hands pay.",
  },
  {
    q: "What happens if nobody picks the winning side?",
    a: "Nothing is paid out and the pot rolls into the next round — so the next flip is bigger.",
  },
];

export function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-20">
      <h2 className="text-center font-display text-4xl uppercase tracking-wide text-gold-metal">FAQ</h2>
      <div className="mt-8 space-y-4">
        {QA.map((item) => (
          <details key={item.q} className="panel group px-6 py-4">
            <summary className="cursor-pointer list-none font-semibold text-amber-50 marker:hidden">
              <span className="mr-2 text-ember-500 transition-transform group-open:rotate-90 inline-block">
                ▸
              </span>
              {item.q}
            </summary>
            <p className="mt-3 pl-6 text-sm leading-relaxed text-amber-100/70">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
