import Link from "next/link";
import { AGENTS } from "@board/shared";

export const metadata = { title: "The Board — THE BOARDROOM" };

export default function AgentsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="eyebrow">The board</div>
      <h1 className="display text-3xl text-cream">Five seats. Five mandates.</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream-dim">
        Each board member is an autonomous agent with a fixed, versioned mandate and a permanently locked 1% governance
        allocation of $BOARD — non-sellable, non-transferable, excluded from rewards, and barred from ever receiving
        treasury payments. Governance alignment, not company equity.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((a) => (
          <Link key={a.id} href={`/agents/${a.id}`} className="panel panel-hover p-5" style={{ borderTopColor: a.color, borderTopWidth: 2 }}>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full border text-lg" style={{ borderColor: a.color, color: a.color }}>
                {a.symbol}
              </span>
              <div>
                <div className="display text-lg text-cream">{a.name}</div>
                <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-cream-dim">{a.title}</div>
              </div>
            </div>
            <p className="mt-3 text-[0.8rem] italic leading-relaxed text-cream-dim">“{a.stance}”</p>
            <ul className="mt-3 space-y-1">
              {a.typicalProposals.slice(0, 3).map((t) => (
                <li key={t} className="font-mono text-[0.68rem] text-cream-faint">
                  · {t}
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-brass-500/15 pt-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-brass-500">
              1% locked allocation · seat {a.seatIndex + 1}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
