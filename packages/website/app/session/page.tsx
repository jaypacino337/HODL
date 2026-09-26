"use client";

import { BoardTable } from "@/components/BoardTable";
import { Transcript } from "@/components/Transcript";
import { ProposalCard } from "@/components/ProposalCard";
import { useSession } from "@/lib/data";

export default function SessionPage() {
  const session = useSession();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Boardroom session</div>
          <h1 className="display text-3xl text-cream">
            {session.sessionNumber ? `Session ${session.sessionNumber}` : "No live session"}
            {session.sessionKind === "demo" && <span className="ml-2 align-middle text-base text-reject">· simulated</span>}
          </h1>
        </div>
        <span className={`chip ${session.connected ? "chip-green" : ""}`}>{session.connected ? "stream connected" : "stream idle"}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,1.05fr]">
        <div className="min-w-0">
          <BoardTable messages={session.messages} votes={session.votes} />
        </div>
        <Transcript messages={session.messages} stage={session.stage} />
      </div>

      <section className="mt-8">
        <h2 className="display mb-4 text-xl text-cream">Proposals this session</h2>
        {session.proposals.length === 0 ? (
          <div className="panel px-5 py-6 text-sm text-cream-dim">No proposals have been tabled.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {session.proposals.map((p) => (
              <ProposalCard key={p.id} p={p} votes={session.votes} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
