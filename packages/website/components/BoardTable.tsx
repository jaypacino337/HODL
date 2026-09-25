"use client";

import Link from "next/link";
import { AGENTS, type AgentVote, type BoardAgent, type BoardMessage } from "@board/shared";

interface SeatState {
  agent: BoardAgent;
  speaking: boolean;
  position: string | null;
  vote: AgentVote | null;
}

function seatStates(messages: BoardMessage[], votes: AgentVote[]): SeatState[] {
  const lastSpeaker = [...messages].reverse().find((m) => m.agentId)?.agentId ?? null;
  return AGENTS.map((agent) => {
    const opening = [...messages].reverse().find((m) => m.agentId === agent.id && (m.kind === "opening" || m.kind === "final"));
    const vote = [...votes].reverse().find((v) => v.agentId === agent.id) ?? null;
    return { agent, speaking: lastSpeaker === agent.id, position: opening?.body ?? null, vote };
  });
}

function SeatCard({ s, compact = false }: { s: SeatState; compact?: boolean }) {
  return (
    <Link
      href={`/agents/${s.agent.id}`}
      className={`panel panel-hover block p-3 ${s.speaking ? "speaking" : ""}`}
      style={{ borderTopColor: s.agent.color, borderTopWidth: 2 }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center rounded-full border font-mono text-sm"
            style={{ borderColor: s.agent.color, color: s.agent.color }}
            aria-hidden
          >
            {s.agent.symbol}
          </span>
          <div>
            <div className="display text-sm leading-none text-cream">{s.agent.name}</div>
            <div className="mt-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-cream-dim">{s.agent.title}</div>
          </div>
        </div>
        {s.speaking && <span className="chip chip-green">speaking</span>}
      </div>
      {!compact && (
        <p className="mt-2 line-clamp-2 text-[0.72rem] leading-snug text-cream-dim">{s.position ?? s.agent.stance}</p>
      )}
      <div className="mt-2 flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-[0.12em]">
        <span className="text-brass-500">1% locked</span>
        {s.vote ? (
          <span className={s.vote.choice === "YES" ? "text-committee-500" : s.vote.choice === "NO" ? "text-reject" : "text-cream-dim"}>
            vote: {s.vote.choice}
          </span>
        ) : (
          <span className="text-cream-faint">no vote yet</span>
        )}
      </div>
    </Link>
  );
}

/**
 * The round boardroom table: five distinct seats around the felt on desktop,
 * a swipeable five-seat rail on small screens.
 */
export function BoardTable({ messages, votes }: { messages: BoardMessage[]; votes: AgentVote[] }) {
  const seats = seatStates(messages, votes);
  // seat angles: BULL top, then clockwise
  const angles = [-90, -18, 54, 126, 198];

  return (
    <div className="max-w-full">
      {/* desktop: the table */}
      <div className="relative mx-auto mb-6 mt-8 hidden aspect-square w-full max-w-[520px] md:block">
        <div className="table-felt seat-ring absolute inset-[18%]" />
        <div className="absolute inset-[18%] grid place-items-center text-center">
          <div>
            <div className="eyebrow">The Board</div>
            <div className="display mt-1 text-xl text-cream">5 seats</div>
            <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-brass-400">5% locked · 3/5 to pass</div>
          </div>
        </div>
        {seats.map((s, i) => {
          const a = (angles[i] * Math.PI) / 180;
          const x = 50 + 40 * Math.cos(a);
          const y = 50 + 41 * Math.sin(a);
          return (
            <div
              key={s.agent.id}
              className="absolute w-[168px] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <SeatCard s={s} compact />
            </div>
          );
        })}
      </div>

      {/* mobile: swipeable seat rail */}
      <div className="seat-rail md:hidden">
        {seats.map((s) => (
          <SeatCard key={s.agent.id} s={s} />
        ))}
      </div>
    </div>
  );
}
