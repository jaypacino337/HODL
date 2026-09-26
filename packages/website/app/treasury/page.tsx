"use client";

import { useBoardState, useTreasury, MODE } from "@/lib/data";
import { fmtUsd, fmtDate, shortAddr } from "@/lib/format";

export default function TreasuryPage() {
  const { snapshot, configured } = useTreasury();
  const { policy } = useBoardState();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="eyebrow">The treasury</div>
      <h1 className="display text-3xl text-cream">One treasury. Zero private levers.</h1>

      {!snapshot ? (
        <div className="panel mt-6 px-5 py-8 text-sm leading-relaxed text-cream-dim">
          <span className="display block text-lg text-cream">No treasury connection yet.</span>
          <p className="mt-2 max-w-xl">
            {configured
              ? "The chain read failed — balances will appear when the RPC responds."
              : MODE === "preview"
                ? "This deployment is not connected to a treasury address, so no balances are shown — real ones or otherwise. The policy below is the live configuration the board will enforce."
                : "Balances appear when the engine has a treasury address configured."}
          </p>
        </div>
      ) : (
        <>
          {!snapshot.verified && (
            <div className="chip chip-red mt-4">simulated demonstration balances — not real</div>
          )}
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Total value", fmtUsd(snapshot.totalUsd)],
              ["Available this session", fmtUsd(snapshot.availableUsd)],
              ["Reserved liabilities", fmtUsd(snapshot.reservedLiabilitiesUsd)],
              ["Recent revenue", fmtUsd(snapshot.recentRevenueUsd)],
            ].map(([k, v]) => (
              <div key={k} className="panel px-4 py-3">
                <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-cream-dim">{k}</div>
                <div className="display mt-1 text-xl text-brass-300">{v}</div>
              </div>
            ))}
          </div>

          <section className="panel mt-4 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="eyebrow">Holdings</span>
              <span className="font-mono text-[0.64rem] text-cream-faint">
                snapshot {snapshot.id} · {fmtDate(snapshot.takenAt)} · {snapshot.treasuryAddress ? shortAddr(snapshot.treasuryAddress) : "no address"}
              </span>
            </div>
            {snapshot.balances.map((b) => {
              const pct = snapshot.totalUsd > 0 ? (b.usdValue / snapshot.totalUsd) * 100 : 0;
              return (
                <div key={b.symbol} className="stat-row">
                  <span className="k">{b.symbol}</span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3 gap-y-1">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-800 sm:w-56">
                      <div className="h-full bg-committee-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="v text-right">{b.amount.toLocaleString()} · {fmtUsd(b.usdValue)}</span>
                  </div>
                </div>
              );
            })}
            {snapshot.previousAllocations.length > 0 && (
              <div className="mt-4 border-t border-brass-500/15 pt-3">
                <div className="eyebrow mb-2">Previous allocations</div>
                {snapshot.previousAllocations.map((a) => (
                  <div key={a.label} className="stat-row">
                    <span className="k">{a.label}</span>
                    <span className="v">{fmtUsd(a.usd)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* the public policy */}
      <section className="mt-10">
        <div className="eyebrow mb-1">Treasury policy — public, enforced, versioned</div>
        <h2 className="display mb-4 text-2xl text-cream">The guardrails ({policy.version})</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="panel p-5">
            <div className="stat-row"><span className="k">Permanent reserve</span><span className="v">{fmtUsd(policy.minPermanentReserveUsd)} — can never be spent</span></div>
            <div className="stat-row"><span className="k">Max per session</span><span className="v">{fmtUsd(policy.maxPerSessionUsd)}</span></div>
            <div className="stat-row"><span className="k">Max per day</span><span className="v">{fmtUsd(policy.maxPerDayUsd)}</span></div>
            <div className="stat-row"><span className="k">Max exposure per asset</span><span className="v">{policy.maxExposurePerAssetPct}% of treasury</span></div>
            <div className="stat-row"><span className="k">Max slippage</span><span className="v">{policy.maxSlippageBps} bps</span></div>
            <div className="stat-row"><span className="k">Proposal lifetime</span><span className="v">≤ {policy.maxProposalLifetimeHours}h</span></div>
            <div className="stat-row"><span className="k">Execution delay</span><span className="v">{policy.executionDelayMinutes} min after passing</span></div>
            <div className="stat-row"><span className="k">Emergency pause</span><span className={`v ${policy.emergencyPaused ? "text-reject" : ""}`}>{policy.emergencyPaused ? "ACTIVE" : "armed, not active"}</span></div>
          </div>
          <div className="panel p-5">
            <div className="stat-row"><span className="k">Approved assets</span><span className="v text-right">{policy.assetAllowlist.join(" · ")}</span></div>
            <div className="stat-row"><span className="k">Approved recipients</span><span className="v">{policy.recipientAllowlist.length === 0 ? "none yet — funding actions cannot execute" : policy.recipientAllowlist.map((r) => r.label).join(", ")}</span></div>
            <div className="stat-row"><span className="k">Normal threshold</span><span className="v">{policy.normalThreshold}/5 agent votes</span></div>
            <div className="stat-row"><span className="k">Sensitive threshold</span><span className="v">{policy.sensitiveThreshold}/5 + holder ratification</span></div>
            <div className="stat-row"><span className="k">Sensitive actions</span><span className="v text-right">{policy.sensitiveActions.map((a) => a.replaceAll("_", " ")).join(" · ")}</span></div>
            <div className="stat-row"><span className="k">Agent self-dealing</span><span className="v text-reject">forbidden — payments to agent wallets always rejected</span></div>
            <div className="stat-row"><span className="k">Unverified contracts</span><span className="v text-reject">forbidden — allowlists only</span></div>
          </div>
        </div>
        <p className="mt-3 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-cream-faint">
          A proposal outside these rules is shown as REJECTED BY TREASURY POLICY with the exact rule that blocked it.
        </p>
      </section>
    </main>
  );
}
