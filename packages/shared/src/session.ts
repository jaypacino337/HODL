import type { ActionType, AgentVote, ProposalStatus, SessionStage, StageLimits, VoteChoice } from "./types";
import { needsHolderRatification, requiredYesVotes, type TreasuryPolicy } from "./policy";

/**
 * Session stage machine. Every stage is bounded in time and messages so the
 * board can never talk forever, and stage order is fixed — the orchestrator
 * only ever moves forward.
 */

export const STAGE_ORDER: SessionStage[] = [
  "SNAPSHOT",
  "OPENING",
  "PROPOSALS",
  "CROSS_EXAMINATION",
  "REVISION",
  "FINAL_STATEMENTS",
  "VOTE",
  "HOLDER_RATIFICATION",
  "EXECUTION",
  "RECEIPTS",
  "ADJOURNED",
];

export const STAGE_LIMITS: Record<SessionStage, StageLimits> = {
  SNAPSHOT: { maxSeconds: 60, maxMessagesPerAgent: 0 },
  OPENING: { maxSeconds: 240, maxMessagesPerAgent: 1 },
  PROPOSALS: { maxSeconds: 300, maxMessagesPerAgent: 1 },
  CROSS_EXAMINATION: { maxSeconds: 480, maxMessagesPerAgent: 3 },
  REVISION: { maxSeconds: 240, maxMessagesPerAgent: 1 },
  FINAL_STATEMENTS: { maxSeconds: 240, maxMessagesPerAgent: 1 },
  VOTE: { maxSeconds: 240, maxMessagesPerAgent: 1 },
  HOLDER_RATIFICATION: { maxSeconds: 0, maxMessagesPerAgent: 0 }, // wall-clock window set by config
  EXECUTION: { maxSeconds: 0, maxMessagesPerAgent: 0 },
  RECEIPTS: { maxSeconds: 60, maxMessagesPerAgent: 0 },
  ADJOURNED: { maxSeconds: 0, maxMessagesPerAgent: 0 },
};

export const STAGE_LABEL: Record<SessionStage, string> = {
  SNAPSHOT: "Treasury snapshot",
  OPENING: "Opening positions",
  PROPOSALS: "Proposals on the table",
  CROSS_EXAMINATION: "Cross-examination",
  REVISION: "Revised proposals",
  FINAL_STATEMENTS: "Final statements",
  VOTE: "The board votes",
  HOLDER_RATIFICATION: "Holder ratification",
  EXECUTION: "Execution",
  RECEIPTS: "Receipts",
  ADJOURNED: "Session adjourned",
};

export function nextStage(s: SessionStage): SessionStage {
  const i = STAGE_ORDER.indexOf(s);
  return STAGE_ORDER[Math.min(i + 1, STAGE_ORDER.length - 1)];
}

// ── proposal state machine ──────────────────────────────────────────────────

const TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  DRAFT: ["DEBATING", "REJECTED", "CANCELLED", "EXPIRED"],
  DEBATING: ["VOTING", "CANCELLED", "EXPIRED"],
  VOTING: ["PASSED", "REJECTED", "EXPIRED"],
  PASSED: ["AWAITING_HOLDER_VOTE", "AWAITING_EXECUTION", "EXPIRED", "CANCELLED"],
  AWAITING_HOLDER_VOTE: ["AWAITING_EXECUTION", "REJECTED", "EXPIRED"],
  AWAITING_EXECUTION: ["EXECUTING", "EXPIRED", "CANCELLED"],
  EXECUTING: ["EXECUTED", "FAILED"],
  REJECTED: [],
  EXECUTED: [],
  FAILED: ["AWAITING_EXECUTION"], // recovery retry path, guarded by ops
  EXPIRED: [],
  CANCELLED: [],
};

export function canTransition(from: ProposalStatus, to: ProposalStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

// ── vote tallying ───────────────────────────────────────────────────────────

export interface TallyResult {
  yes: number;
  no: number;
  abstain: number;
  required: number;
  passed: boolean;
  nextStatus: ProposalStatus;
}

export function tallyAgentVotes(
  policy: TreasuryPolicy,
  actionType: ActionType,
  votes: AgentVote[]
): TallyResult {
  // one vote per agent — the first recorded vote is final, duplicates ignored
  const byAgent = new Map<string, VoteChoice>();
  for (const v of votes) if (!byAgent.has(v.agentId)) byAgent.set(v.agentId, v.choice);
  let yes = 0;
  let no = 0;
  let abstain = 0;
  for (const c of byAgent.values()) {
    if (c === "YES") yes++;
    else if (c === "NO") no++;
    else abstain++;
  }
  const required = requiredYesVotes(policy, actionType);
  const passed = yes >= required;
  const nextStatus: ProposalStatus = !passed
    ? "REJECTED"
    : needsHolderRatification(policy, actionType)
      ? "AWAITING_HOLDER_VOTE"
      : "AWAITING_EXECUTION";
  return { yes, no, abstain, required, passed, nextStatus };
}
