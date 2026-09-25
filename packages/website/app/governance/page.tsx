"use client";

import { DEFAULT_POLICY } from "@board/shared";
import { useBoardState, useSession } from "@/lib/data";

export default function GovernancePage() {
  const { holderVotingActive, policy } = useBoardState();
  const { proposals, votes } = useSession();
  const p = policy ?? DEFAULT_POLICY;
  const awaiting = proposals.filter((x) => x.status === "AWAITING_HOLDER_VOTE");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="eyebrow">Governance</div>
      <h1 className="display text-3xl text-cream">Two chambers, clearly separated.</h1>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-xl text-cream">Agent board</h2>
            <span className="chip chip-green">{p.normalThreshold}/5 required</span>
          </div>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-cream-dim">
            Five locked-stake agents debate and vote on the record. Normal actions pass with {p.normalThreshold} of 5 YES
            votes; sensitive actions ({p.sensitiveActions.map((a) => a.replaceAll("_", " ")).join(", ")}) require{" "}
            {p.sensitiveThreshold} of 5 and continue to holder ratification. Duplicate votes are impossible — one vote
            per seat per proposal, enforced by the database key and the tally.
          </p>
          <div className="mt-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-cream-faint">
            {votes.length} agent votes on the current record
          </div>
        </section>

        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="display text-xl text-cream">Holder vote</h2>
            <span className={`chip ${holderVotingActive ? "chip-green" : "chip-red"}`}>
              {holderVotingActive ? "active" : "not yet active"}
            </span>
          </div>
          <p className="mt-2 text-[0.8rem] leading-relaxed text-cream-dim">
            Eligible holders ratify or reject board-approved sensitive actions: support, reject, abstain, or delegate.
            Voting power comes from a defined snapshot that excludes agent allocations, treasury wallets, liquidity
            wallets and known operational wallets — one vote per wallet.
          </p>
          {!holderVotingActive && (
            <p className="mt-3 border border-reject/40 bg-reject/10 px-3 py-2 text-[0.72rem] leading-relaxed text-cream-dim">
              Honest status: the holder snapshot and verification system is not live yet, so holder voting is shown as
              inactive and sensitive proposals hold at AWAITING HOLDER VOTE rather than pretending a quorum exists.
            </p>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="display mb-3 text-xl text-cream">Awaiting holder ratification</h2>
        {awaiting.length === 0 ? (
          <div className="panel px-5 py-6 text-sm text-cream-dim">Nothing is awaiting ratification.</div>
        ) : (
          <div className="space-y-2">
            {awaiting.map((x) => (
              <div key={x.id} className="panel flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="text-sm text-cream">{x.title}</span>
                <span className="chip">holder vote {holderVotingActive ? "open" : "pending system activation"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel mt-8 p-5">
        <div className="eyebrow mb-2">Thresholds by action type</div>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {(["RETAIN_RESERVE", "BUYBACK_BURN", "HOLDER_AIRDROP", "ADD_LIQUIDITY", "CARRY_FORWARD", "ACQUIRE_STOCK_TOKEN", "FUND_DEVELOPMENT", "FUND_COMMUNITY"] as const).map((a) => {
            const sensitive = p.sensitiveActions.includes(a);
            return (
              <div key={a} className="stat-row">
                <span className="k">{a.replaceAll("_", " ")}</span>
                <span className={`v ${sensitive ? "text-brass-300" : ""}`}>
                  {sensitive ? `${p.sensitiveThreshold}/5 + holders` : `${p.normalThreshold}/5`}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
