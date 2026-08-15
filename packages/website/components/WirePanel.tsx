"use client";

import type { FeedEvent } from "@/lib/api";
import { hhmmss } from "@/lib/format";

const KIND_COLOR: Record<string, string> = {
  claim: "text-amber",
  buyback: "pos",
  reward: "text-cyan",
  scan: "text-paper",
  post: "text-cyan",
  ad: "text-amber",
};

export function WirePanel({ events }: { events: FeedEvent[] }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="fkey">F6</span>The Wire
        </div>
        <div className="label">ENGINE EVENTS · LIVE</div>
      </div>
      <div className="max-h-[260px] overflow-y-auto p-3">
        {events.map((e, i) => (
          <div key={`${e.at}-${i}`} className="flex gap-3 border-b border-term-border/40 py-1.5 text-[11px] last:border-b-0">
            <span className="num shrink-0 text-dim">{hhmmss(e.at)}</span>
            <span className={KIND_COLOR[e.kind] ?? "text-paper"}>{e.text}</span>
          </div>
        ))}
        {events.length === 0 && (
          <div className="py-6 text-center text-[11px] uppercase tracking-[0.14em] text-dim">
            Wire silent — events print the moment the engine claims, buys, or pays.
          </div>
        )}
      </div>
    </section>
  );
}
