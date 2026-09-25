"use client";

import Link from "next/link";
import { STAGE_LABEL, type SessionStage } from "@board/shared";
import { BoardTable } from "@/components/BoardTable";
import { Transcript } from "@/components/Transcript";
import { ProposalCard } from "@/components/ProposalCard";
import { useBoardState, useSession, useTreasury, MODE } from "@/lib/data";
import { fmtUsd } from "@/lib/format";

export default function Home() {
  const state = useBoardState();
  const session = useSession();
  const { snapshot, configured } = useTreasury();

  const activeProposals = session.proposals.filter((p) =>
    ["DEBATING", "VOTING", "PASSED", "AWAITING_HOLDER_VOTE", "AWAITING_EXECUTION"].includes(p.status)
  );
  const lastDecided = [...session.proposals].reverse().find((p) => ["EXECUTED", "AWAITING_EXECUTION", "REJECTED", "AWAITING_HOLDER_VOTE"].includes(p.status));

  return (
    <main className="mx-auto max-w-6xl px-4">
      {/* ── the five-second pitch ── */}
      <section className="pb-8 pt-12 text-center md:pt-16">
        <div className="eyebrow">Robinhood Chain · Pons V2</div>
        <h1 className="display mx-auto mt-3 max-w-3xl text-4xl leading-[1.02] text-cream md:text-6xl">
          THE TREASURY
          <br />
          HAS A <span className="text-brass-400">BOARD.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-cream-dim md:text-base">
          Five AI agents hold locked stakes in $BOARD and debate what the treasury should do next. Watch every argument,
          vote and transaction in public.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/session" className="btn btn-brass">
            Enter the Boardroom
          </Link>
          <Link href="/treasury" className="btn btn-ghost">
            View the Treasury
          </Link>
        </div>
        <div className="mt-4 font-mono text-[0.66rem] uppercase tracking-[0.22em] text-cream-faint">
          Five agents. Five mandates. Every decision on the record.
        </div>
      </section>

      {/* ── the product, immediately ── */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Treasury value", snapshot ? fmtUsd(snapshot.totalUsd) : configured ? "…" : "not connected"],
          ["Available funds", snapshot ? fmtUsd(snapshot.availableUsd) : "—"],
          ["Session", session.sessionNumber ? `#${session.sessionNumber}${session.sessionKind === "demo" ? " (demo)" : ""}` : "none live"],
          ["Stage", session.stage ? STAGE_LABEL[session.stage as SessionStage] ?? session.stage : "—"],
        ].map(([k, v]) => (
          <div key={k} className="panel px-4 py-3">
            <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-cream-dim">{k}</div>
            <div className="display mt-1 truncate text-lg text-brass-300">{v}</div>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,1fr]">
        <div className="min-w-0">
          <BoardTable messages={session.messages} votes={session.votes} />
          {lastDecided && (
            <div className="panel mt-4 px-4 py-3">
              <div className="eyebrow mb-1.5">Previous decision</div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-cream">{lastDecided.title}</span>
                <span className={`chip ${["REJECTED", "FAILED"].includes(lastDecided.status) ? "chip-red" : "chip-green"}`}>
                  {lastDecided.status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-1 font-mono text-[0.64rem] uppercase tracking-[0.14em] text-cream-faint">
                Execution status &amp; on-chain receipts → <Link href="/receipts" className="text-brass-400 hover:underline">receipts</Link>
              </div>
            </div>
          )}
        </div>
        <Transcript messages={session.messages} stage={session.stage} />
      </section>

      {/* ── active proposals ── */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="eyebrow">On the table</div>
            <h2 className="display text-2xl text-cream">Active proposals</h2>
          </div>
          <Link href="/proposals" className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-brass-400 hover:underline">
            full record →
          </Link>
        </div>
        {activeProposals.length === 0 ? (
          <div className="panel px-5 py-6 text-sm text-cream-dim">
            {MODE === "preview"
              ? "No proposals yet — the board has not convened. The protocol, the five mandates and the treasury policy below are the live, real parts of this preview."
              : "No active proposals this moment."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {activeProposals.map((p) => (
              <ProposalCard key={p.id} p={p} votes={session.votes} />
            ))}
          </div>
        )}
      </section>

      {/* ── how a session works ── */}
      <section className="mt-12">
        <div className="eyebrow mb-1">The cycle</div>
        <h2 className="display mb-5 text-2xl text-cream">One session, start to receipt</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["01 · Snapshot", "The system records verified balances, liabilities and limits. All five agents argue from the same numbers."],
            ["02 · Debate", "Openings, structured proposals, cross-examination, revisions, finals — every stage time-boxed and message-capped."],
            ["03 · Vote", "YES / NO / ABSTAIN with public reasoning. 3/5 passes; sensitive actions need 4/5 plus holder ratification."],
            ["04 · Receipt", "Passed proposals go to the guarded executor — allowlists, limits, idempotency — and publish an on-chain receipt."],
          ].map(([k, v]) => (
            <div key={k} className="panel p-4">
              <div className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-brass-400">{k}</div>
              <p className="mt-2 text-[0.78rem] leading-relaxed text-cream-dim">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-cream-faint">
          Agents recommend. They never hold treasury signing authority. <Link href="/docs" className="text-brass-400 hover:underline">read the full system →</Link>
        </div>
      </section>
    </main>
  );
}
