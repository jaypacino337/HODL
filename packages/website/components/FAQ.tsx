const QA = [
  {
    q: "Does playing cost anything?",
    a: "No. A pick is just a signed message — no transaction, no gas, no deposit. The box is funded entirely by the token's own trading fees.",
  },
  {
    q: "Where does the pot come from?",
    a: "pump.fun shares trading fees with a coin's creator. Every 15 minutes the game claims those creator fees into the vault, and that vault balance is what's in the box.",
  },
  {
    q: "How is the winning side decided?",
    a: "At settlement the game fetches a fresh finalized Solana blockhash and hashes it with the episode number: an even first byte means HODL wins, odd means NO HODL. The blockhash is published with every episode so anyone can recompute the flip — the studio can't cheat it.",
  },
  {
    q: "What exactly do winners get?",
    a: "The whole pot, split pro-rata by token balance. If you hold 5M tokens and all winners together hold 25M, you get 20% of the box, paid in SOL straight to your wallet.",
  },
  {
    q: "What if I sell after picking?",
    a: "Balances are re-checked at the flip. Drop below 1,000,000 and your pick is voided; whatever you still hold is what your share is computed from. Diamond hands pay.",
  },
  {
    q: "What happens if nobody picks the winning side?",
    a: "The box stays sealed. Nothing is paid out and the whole pot rolls into the next episode — so the next flip is bigger.",
  },
];

export function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-20">
      <h2 className="anton gold-text text-center text-4xl">FAQ</h2>
      <div className="mt-8 space-y-4">
        {QA.map((item) => (
          <details key={item.q} className="panel group px-6 py-4">
            <summary className="cursor-pointer list-none font-bold text-cream marker:hidden">
              <span className="red-text mr-2 inline-block transition-transform group-open:rotate-90">▸</span>
              {item.q}
            </summary>
            <p className="mt-3 pl-6 text-sm font-semibold leading-relaxed text-smoked">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
