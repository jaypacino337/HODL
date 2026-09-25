"use client";

import { useReceipts, MODE } from "@/lib/data";
import { fmtDate, fmtUsd, shortAddr } from "@/lib/format";

export default function ReceiptsPage() {
  const receipts = useReceipts();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="eyebrow">Proof</div>
      <h1 className="display text-3xl text-cream">Execution receipts.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream-dim">
        Every executed decision publishes its transaction hash, chain, block, assets moved, recipient, the full agent
        vote, and the holder tally where one applied. If it isn't here with a hash, it didn't execute.
      </p>

      {receipts.length === 0 ? (
        <div className="panel mt-6 px-5 py-8 text-sm leading-relaxed text-cream-dim">
          <span className="display block text-lg text-cream">No executions yet.</span>
          <p className="mt-2 max-w-xl">
            {MODE === "demo"
              ? "The demo script stops before execution on purpose — receipts are never simulated, even in demo mode."
              : "BOARD DECISIONS ARE PUBLIC. EXECUTION IS NOT YET ACTIVE. When the guarded executor goes live, every receipt lands here with a verifiable hash."}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {receipts.map((r) => (
            <article key={r.proposal_id} className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={`chip ${r.final_status === "EXECUTED" ? "chip-green" : "chip-red"}`}>{r.final_status}</span>
                <span className="font-mono text-[0.68rem] text-cream-dim">{fmtDate(r.ts)}</span>
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <div className="stat-row"><span className="k">Tx hash</span><span className="v break-all text-brass-300">{r.tx_hash}</span></div>
                <div className="stat-row"><span className="k">Chain / block</span><span className="v">{r.chain_id} / {r.block_number}</span></div>
                <div className="stat-row"><span className="k">Moved</span><span className="v">{fmtUsd(Number(r.amount_usd))} {r.asset}</span></div>
                <div className="stat-row"><span className="k">Recipient</span><span className="v">{shortAddr(r.recipient) ?? "burn"}</span></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(r.agent_votes ?? []).map((v: any) => (
                  <span key={v.agentId} className={`chip ${v.choice === "YES" ? "chip-green" : v.choice === "NO" ? "chip-red" : ""}`}>
                    {v.agentId}: {v.choice}
                  </span>
                ))}
                {r.holder_tally && (
                  <span className="chip">
                    holders: {r.holder_tally.active ? `${r.holder_tally.forPower} for / ${r.holder_tally.againstPower} against` : "n/a (system inactive)"}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
