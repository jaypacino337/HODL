import { AGENT_BY_ID, DEFAULT_POLICY, requiredYesVotes, type AgentVote, type Proposal } from "@board/shared";
import { fmtDate, fmtUsd, shortAddr } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  DEBATING: "chip",
  VOTING: "chip chip-green",
  PASSED: "chip chip-green",
  AWAITING_HOLDER_VOTE: "chip",
  AWAITING_EXECUTION: "chip chip-green",
  EXECUTING: "chip chip-green",
  EXECUTED: "chip chip-green",
  REJECTED: "chip chip-red",
  FAILED: "chip chip-red",
  EXPIRED: "chip",
  CANCELLED: "chip",
  DRAFT: "chip",
};

export function ProposalCard({ p, votes }: { p: Proposal; votes: AgentVote[] }) {
  const agent = AGENT_BY_ID[p.agentId];
  const mine = votes.filter((v) => v.proposalId === p.id);
  const yes = mine.filter((v) => v.choice === "YES").length;
  const no = mine.filter((v) => v.choice === "NO").length;
  const required = requiredYesVotes(DEFAULT_POLICY, p.actionType);

  return (
    <article className="panel p-4" style={{ borderLeftColor: agent?.color, borderLeftWidth: 2 }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-cream-dim">
            <span style={{ color: agent?.color }}>{agent?.name}</span> · {p.actionType.replaceAll("_", " ")} · r{p.revision}
          </div>
          <h3 className="display mt-0.5 text-base text-cream">{p.title}</h3>
        </div>
        <span className={STATUS_STYLE[p.status] ?? "chip"}>{p.status.replaceAll("_", " ")}</span>
      </div>

      {p.policyViolation ? (
        <div className="mt-3 border border-reject/50 bg-reject/10 px-3 py-2">
          <div className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-reject">
            Rejected by treasury policy — {p.policyViolation.rule}
          </div>
          <p className="mt-1 text-xs text-cream-dim">{p.policyViolation.ruleText}</p>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            {[
              ["Amount", `${fmtUsd(p.amountUsd)} ${p.asset}`],
              ["Of available", `${p.pctOfAvailable.toFixed(1)}%`],
              ["Max slippage", `${p.maxSlippageBps} bps`],
              ["Expires", fmtDate(p.expiresAt)],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-cream-faint">{k}</div>
                <div className="font-mono text-[0.78rem] text-cream">{v}</div>
              </div>
            ))}
          </div>
          {p.recipient && (
            <div className="mt-1.5 font-mono text-[0.68rem] text-cream-dim">recipient: {shortAddr(p.recipient)}</div>
          )}
          <div className="mt-3 space-y-1.5 text-[0.76rem] leading-relaxed">
            <p><span className="font-mono text-[0.62rem] uppercase tracking-wider text-committee-500">Expected · </span><span className="text-cream-dim">{p.expectedResult}</span></p>
            <p><span className="font-mono text-[0.62rem] uppercase tracking-wider text-reject">Risk · </span><span className="text-cream-dim">{p.primaryRisk}</span></p>
            <p><span className="font-mono text-[0.62rem] uppercase tracking-wider text-brass-400">Data · </span><span className="text-cream-dim">{p.supportingData}</span></p>
          </div>
        </>
      )}

      {mine.length > 0 && (
        <div className="mt-3 border-t border-brass-500/15 pt-2.5">
          <div className="mb-1.5 flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-[0.14em] text-cream-dim">
            <span>Board vote</span>
            <span>
              {yes} yes / {no} no — needs {required}/5
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {mine.map((v) => {
              const va = AGENT_BY_ID[v.agentId];
              return (
                <span
                  key={v.agentId}
                  title={v.explanation}
                  className={`chip ${v.choice === "YES" ? "chip-green" : v.choice === "NO" ? "chip-red" : ""}`}
                  style={{ borderLeftColor: va?.color, borderLeftWidth: 2 }}
                >
                  {va?.name} · {v.choice}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}
