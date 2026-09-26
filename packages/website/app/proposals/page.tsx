"use client";

import { useState } from "react";
import { ProposalCard } from "@/components/ProposalCard";
import { useProposals, useSession } from "@/lib/data";

const FILTERS = ["ALL", "ACTIVE", "EXECUTED", "REJECTED"] as const;

export default function ProposalsPage() {
  const proposals = useProposals();
  const { votes } = useSession();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");

  const shown = proposals.filter((p) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return ["DEBATING", "VOTING", "PASSED", "AWAITING_HOLDER_VOTE", "AWAITING_EXECUTION", "EXECUTING"].includes(p.status);
    if (filter === "EXECUTED") return p.status === "EXECUTED";
    return ["REJECTED", "FAILED", "EXPIRED", "CANCELLED"].includes(p.status);
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="eyebrow">The record</div>
      <h1 className="display text-3xl text-cream">Every proposal, forever.</h1>
      <div className="mt-5 flex gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip ${filter === f ? "chip-green" : ""}`}>
            {f}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="panel mt-6 px-5 py-8 text-sm text-cream-dim">
          Nothing on the record{filter !== "ALL" ? " under this filter" : " yet — proposals appear the moment the board first convenes"}.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {shown.map((p) => (
            <ProposalCard key={p.id} p={p} votes={votes} />
          ))}
        </div>
      )}
    </main>
  );
}
