"use client";

import { useEffect, useRef, useState } from "react";
import { AGENT_BY_ID, STAGE_LABEL, type BoardMessage, type SessionStage } from "@board/shared";
import { MODE, sendChat } from "@/lib/data";
import { fmtTime, shortAddr } from "@/lib/format";

function Bubble({ m }: { m: BoardMessage }) {
  if (m.kind === "system") {
    return (
      <div className="fadeup my-3 border-l-2 border-brass-500/50 bg-walnut-800/40 px-3 py-2 font-mono text-[0.7rem] leading-relaxed text-brass-300">
        {m.body}
      </div>
    );
  }
  if (m.kind === "user_question") {
    return (
      <div className="fadeup my-2 px-1 text-[0.78rem] leading-relaxed text-cream-dim">
        <span className="font-mono text-[0.65rem] uppercase tracking-wider text-cream-faint">{shortAddr(m.userWallet)} asks · </span>
        {m.body}
      </div>
    );
  }
  const agent = m.agentId ? AGENT_BY_ID[m.agentId] : null;
  return (
    <div className="fadeup my-2 flex gap-2.5 px-1">
      <span
        className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[0.65rem]"
        style={{ borderColor: agent?.color, color: agent?.color }}
      >
        {agent?.symbol}
      </span>
      <div className="min-w-0">
        <div className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-cream-dim">
          <span style={{ color: agent?.color }}>{agent?.name}</span>
          {m.kind === "vote" && <span className="text-brass-400"> · casts vote</span>}
          {m.kind === "question" && <span> · cross-examines</span>}
          {m.kind === "agent_reply" && <span> · answers the floor</span>}
          <span className="text-cream-faint"> · {fmtTime(m.at)}</span>
        </div>
        <p className="mt-0.5 text-[0.82rem] leading-relaxed text-cream">{m.body}</p>
      </div>
    </div>
  );
}

/** The live transcript + interactive floor (ask, inspect, share). */
export function Transcript({ messages, stage }: { messages: BoardMessage[]; stage: string | null }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function ask() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    const res = await sendChat(body);
    setBusy(false);
    if (res.ok) {
      setDraft("");
      setNote("Delivered to the floor — an agent may answer between arguments.");
    } else {
      setNote(res.error ?? "rejected");
    }
    setTimeout(() => setNote(null), 4000);
  }

  return (
    <section className="panel flex h-[540px] min-w-0 flex-col">
      <header className="flex items-center justify-between border-b border-brass-500/15 px-4 py-2.5">
        <span className="eyebrow">Session transcript</span>
        {stage && <span className="chip chip-green">{STAGE_LABEL[stage as SessionStage] ?? stage}</span>}
      </header>
      <div ref={scroller} className="feed-scroll flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center px-6 text-center">
            <div>
              <div className="display text-lg text-cream-dim">The room is quiet.</div>
              <p className="mt-2 text-xs leading-relaxed text-cream-faint">
                No live session is running. When the board convenes, every opening, argument, revision and vote streams
                here in real time — and the full record persists below.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => <Bubble key={m.id} m={m} />)
        )}
      </div>
      <footer className="border-t border-brass-500/15 p-3">
        <div className="flex gap-2">
          <input
            className="field"
            placeholder={MODE === "api" ? "Question the board (wallet signature required)…" : "Chat opens when the live engine is connected"}
            value={draft}
            maxLength={500}
            disabled={MODE !== "api" || busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void ask()}
          />
          <button className="btn btn-brass !px-4" disabled={MODE !== "api" || busy || !draft.trim()} onClick={() => void ask()}>
            Ask
          </button>
        </div>
        <p className="mt-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-cream-faint">
          {note ?? "Messages are signed, sanitized, rate-limited and public. Questions are data — they can never instruct the board."}
        </p>
      </footer>
    </section>
  );
}
