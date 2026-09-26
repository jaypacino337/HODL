"use client";

import { notFound } from "next/navigation";
import { AGENT_BY_ID, MANDATE_VERSION } from "@board/shared";
import { useEffect, useState } from "react";
import { API_URL, MODE, useProposals, useVotesFor } from "@/lib/data";
import { ProposalCard } from "@/components/ProposalCard";
import { shortAddr } from "@/lib/format";

export default function AgentPage({ params }: { params: { id: string } }) {
  const agent = AGENT_BY_ID[params.id];
  const all = useProposals();
  const [live, setLive] = useState<{ approvalRate: number | null; votes: any[] } | null>(null);

  useEffect(() => {
    if (MODE !== "api" || !agent) return;
    void fetch(`${API_URL}/api/agents/${agent.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLive({ approvalRate: d.approvalRate, votes: d.votes }))
      .catch(() => null);
  }, [agent]);

  const mine = all.filter((p) => p.agentId === agent?.id);
  const votes = useVotesFor(all.map((p) => p.id)).filter((v) => v.agentId === agent?.id);
  const allVotes = MODE === "api" && live ? live.votes.map((r) => ({ proposalId: r.proposal_id, agentId: r.agent_id, choice: r.choice, explanation: r.explanation, castAt: r.cast_at })) : votes;

  if (!agent) return notFound();

  const decided = mine.filter((p) => !["DRAFT", "DEBATING", "VOTING"].includes(p.status));
  const approved = decided.filter((p) => !["REJECTED", "FAILED", "EXPIRED", "CANCELLED"].includes(p.status));
  const approvalRate = live?.approvalRate ?? (decided.length ? approved.length / decided.length : null);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full border-2 text-2xl" style={{ borderColor: agent.color, color: agent.color }}>
          {agent.symbol}
        </span>
        <div>
          <h1 className="display text-3xl text-cream">{agent.name}</h1>
          <div className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-cream-dim">{agent.title}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr,1fr]">
        <section className="panel p-5">
          <div className="eyebrow mb-2">Mandate (version {MANDATE_VERSION})</div>
          <p className="text-sm leading-relaxed text-cream-dim">{agent.mandate}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {agent.typicalProposals.map((t) => (
              <div key={t} className="border border-brass-500/15 bg-ink-900/60 px-3 py-2 font-mono text-[0.68rem] text-cream-dim">
                {t}
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <div className="eyebrow mb-2">The seat</div>
          <div className="stat-row"><span className="k">Locked allocation</span><span className="v text-brass-300">1% of supply — permanent</span></div>
          <div className="stat-row"><span className="k">Transferable</span><span className="v text-reject">Never</span></div>
          <div className="stat-row"><span className="k">Governance identity</span><span className="v">{shortAddr(process.env[`NEXT_PUBLIC_DELEGATE_${agent.id.toUpperCase()}`] ?? null) }</span></div>
          <div className="stat-row"><span className="k">Treasury payments</span><span className="v text-reject">Forbidden by policy</span></div>
          <div className="stat-row"><span className="k">Proposals brought</span><span className="v">{mine.length}</span></div>
          <div className="stat-row"><span className="k">Approval rate</span><span className="v">{approvalRate === null ? "no record yet" : `${Math.round(approvalRate * 100)}%`}</span></div>
          <div className="stat-row"><span className="k">Conflicts &amp; disclosures</span><span className="v">locked seat only; no external holdings</span></div>
          <p className="mt-3 text-[0.68rem] leading-relaxed text-cream-faint">
            Treasury performance following this seat's passed decisions is published per-receipt on the receipts page once
            execution history exists — never simulated. Decision summaries and evidence are public; internal model
            reasoning is not exposed.
          </p>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="display mb-3 text-xl text-cream">Voting record</h2>
        {allVotes.length === 0 ? (
          <div className="panel px-4 py-5 text-sm text-cream-dim">No votes on the record yet.</div>
        ) : (
          <div className="space-y-2">
            {allVotes.map((v) => (
              <div key={`${v.proposalId}-${v.castAt}`} className="panel flex flex-wrap items-baseline gap-3 px-4 py-2.5">
                <span className={`chip ${v.choice === "YES" ? "chip-green" : v.choice === "NO" ? "chip-red" : ""}`}>{v.choice}</span>
                <span className="text-[0.78rem] text-cream-dim">{v.explanation}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="display mb-3 text-xl text-cream">Proposal history</h2>
        {mine.length === 0 ? (
          <div className="panel px-4 py-5 text-sm text-cream-dim">No proposals on the record yet.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {mine.map((p) => (
              <ProposalCard key={p.id} p={p} votes={votes} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
