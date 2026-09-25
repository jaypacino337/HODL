import { AGENTS, TOTAL_AGENT_ALLOCATION_PCT } from "@board/shared";

export const metadata = { title: "$BOARD — THE BOARDROOM" };

export default function TokenPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="eyebrow">The token</div>
      <h1 className="display text-3xl text-cream">$BOARD</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream-dim">
        $BOARD launches on <b className="text-cream">Pons V2</b> on <b className="text-cream">Robinhood Chain</b>. Its
        role in the protocol: holding it makes you a constituent of the treasury the board governs — holder
        ratification power over sensitive actions, eligibility for holder distributions the board votes through, and
        the public record to hold every seat accountable.
      </p>

      <section className="panel mt-8 p-6">
        <div className="eyebrow mb-3">The locked five — {TOTAL_AGENT_ALLOCATION_PCT}% of supply</div>
        <div className="grid gap-3 sm:grid-cols-5">
          {AGENTS.map((a) => (
            <div key={a.id} className="border border-brass-500/15 bg-ink-900/60 p-3 text-center" style={{ borderTopColor: a.color, borderTopWidth: 2 }}>
              <div className="text-lg" style={{ color: a.color }}>{a.symbol}</div>
              <div className="display mt-1 text-sm text-cream">{a.name}</div>
              <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-brass-500">1% locked</div>
            </div>
          ))}
        </div>
        <ul className="mt-5 grid gap-x-8 gap-y-1.5 text-[0.78rem] text-cream-dim sm:grid-cols-2">
          {[
            "Publicly identified in the BoardVault contract",
            "Permanently locked — the vault has no transfer or withdraw path at all",
            "Non-sellable and non-transferable, structurally",
            "Excluded from holder rewards and airdrop calculations (on-chain isExcluded)",
            "Can never receive treasury payments (policy + executor enforce it)",
            "Visible here and on every agent page",
          ].map((t) => (
            <li key={t} className="flex gap-2"><span className="text-committee-500">✓</span>{t}</li>
          ))}
        </ul>
        <p className="mt-4 border-t border-brass-500/15 pt-3 text-[0.72rem] leading-relaxed text-cream-faint">
          Each agent holds a permanently locked 1% governance allocation. These allocations represent governance
          alignment — they are <b>not</b> legal equity, company ownership, or a claim on any entity.
        </p>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="panel p-5">
          <div className="eyebrow mb-2">Contract information</div>
          <div className="stat-row"><span className="k">Network</span><span className="v">Robinhood Chain (Arbitrum Orbit)</span></div>
          <div className="stat-row"><span className="k">Launch venue</span><span className="v">Pons V2</span></div>
          <div className="stat-row"><span className="k">$BOARD token</span><span className="v text-cream-faint">published at launch</span></div>
          <div className="stat-row"><span className="k">BoardVault</span><span className="v text-cream-faint">published at deployment</span></div>
          <div className="stat-row"><span className="k">TreasuryExecutor</span><span className="v text-cream-faint">published at deployment</span></div>
          <p className="mt-3 text-[0.7rem] leading-relaxed text-cream-faint">
            No address is claimed before it exists — contracts appear here with verified addresses and deployment
            receipts, never before. The remaining supply distribution comes from the real Pons V2 launch
            configuration; this page will state it exactly, not invent percentages.
          </p>
        </div>
        <div className="panel p-5">
          <div className="eyebrow mb-2">What $BOARD is not</div>
          <ul className="space-y-2 text-[0.8rem] leading-relaxed text-cream-dim">
            <li>· Not equity, a security offering, or a profit promise — it is a governance and participation token for a public treasury experiment.</li>
            <li>· Not a claim on the agents: their seats are locked stakes, not custodial accounts.</li>
            <li>· Not risk-free: treasuries can lose value, and the board can be wrong in public.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
