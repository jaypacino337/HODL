/** THE BOARDROOM — shared domain types. Used by the engine, the website and
 * the contracts' off-chain mirrors. All USD amounts are display-level numbers
 * (USDG has 6 decimals on-chain; the executor layer owns wei math). */

// ── launch truthfulness ─────────────────────────────────────────────────────

/** What is actually live. The site must render exactly this, never more. */
export type LaunchState =
  | "PREVIEW" // agents + policy visible, no live session yet
  | "DEBATE_LIVE" // sessions run and are public
  | "VOTING_LIVE" // agent voting recorded on the record
  | "EXECUTION_GUARDED" // execution wired through the guarded signer
  | "FULLY_ACTIVE"
  | "PAUSED";

export const EXECUTION_INACTIVE_BANNER =
  "BOARD DECISIONS ARE PUBLIC. EXECUTION IS NOT YET ACTIVE.";

// ── agents ──────────────────────────────────────────────────────────────────

export type AgentId = "bull" | "burn" | "dividend" | "vault" | "degen";

export interface BoardAgent {
  id: AgentId;
  name: string;
  title: string;
  mandate: string;
  /** One-line seat card summary. */
  stance: string;
  typicalProposals: string[];
  color: string; // seat accent (used only to identify seats)
  symbol: string; // single glyph for the seat
  /** Permanently locked governance allocation, % of $BOARD supply. */
  lockedAllocationPct: number;
  /** BoardVault seat index on-chain (0..4). */
  seatIndex: number;
}

// ── treasury ────────────────────────────────────────────────────────────────

export interface AssetBalance {
  symbol: string; // "USDG", "ETH", "AAPLx"…
  address: string | null; // token contract, null for native
  amount: number;
  usdValue: number;
}

/** The verified snapshot every agent reasons over. Identical for all five. */
export interface TreasurySnapshot {
  id: string;
  takenAt: string; // ISO
  chainId: number;
  treasuryAddress: string | null;
  balances: AssetBalance[]; // includes USDG, ETH, stock tokens, $BOARD
  totalUsd: number;
  /** Spendable this session after policy reserve + liabilities. */
  availableUsd: number;
  reservedLiabilitiesUsd: number;
  recentRevenueUsd: number;
  previousAllocations: Array<{ label: string; usd: number }>;
  policyVersion: string;
  /** True when read from chain; false for the labeled demo fixture. */
  verified: boolean;
}

// ── proposals ───────────────────────────────────────────────────────────────

export type ActionType =
  | "RETAIN_RESERVE"
  | "ACQUIRE_STOCK_TOKEN"
  | "ADD_LIQUIDITY"
  | "BUYBACK_BURN"
  | "HOLDER_AIRDROP"
  | "FUND_DEVELOPMENT"
  | "FUND_COMMUNITY"
  | "CARRY_FORWARD";

export type ProposalStatus =
  | "DRAFT"
  | "DEBATING"
  | "VOTING"
  | "PASSED"
  | "REJECTED"
  | "AWAITING_HOLDER_VOTE"
  | "AWAITING_EXECUTION"
  | "EXECUTING"
  | "EXECUTED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export interface Proposal {
  id: string;
  sessionId: string;
  agentId: AgentId;
  revision: number;
  title: string;
  actionType: ActionType;
  asset: string;
  recipient: string | null;
  amountUsd: number;
  pctOfAvailable: number;
  maxSlippageBps: number;
  expiresAt: string;
  expectedResult: string;
  primaryRisk: string;
  supportingData: string;
  status: ProposalStatus;
  createdAt: string;
  /** Set when policy rejected it: the exact public rule. */
  policyViolation?: { rule: string; ruleText: string };
}

// ── votes ───────────────────────────────────────────────────────────────────

export type VoteChoice = "YES" | "NO" | "ABSTAIN";

export interface AgentVote {
  proposalId: string;
  agentId: AgentId;
  choice: VoteChoice;
  explanation: string;
  castAt: string;
}

export interface HolderVoteTally {
  proposalId: string;
  snapshotBlock: number | null;
  forPower: number;
  againstPower: number;
  abstainPower: number;
  quorumPower: number;
  /** False until the snapshot + verification system is actually live. */
  active: boolean;
}

// ── sessions ────────────────────────────────────────────────────────────────

export type SessionStage =
  | "SNAPSHOT"
  | "OPENING"
  | "PROPOSALS"
  | "CROSS_EXAMINATION"
  | "REVISION"
  | "FINAL_STATEMENTS"
  | "VOTE"
  | "HOLDER_RATIFICATION"
  | "EXECUTION"
  | "RECEIPTS"
  | "ADJOURNED";

export interface StageLimits {
  maxSeconds: number;
  /** Max messages per agent in this stage (0 = no agent messages). */
  maxMessagesPerAgent: number;
}

export interface BoardSession {
  id: string;
  number: number;
  stage: SessionStage;
  stageStartedAt: string;
  startedAt: string;
  snapshotId: string | null;
  /** "live" (real agents on the record) or "demo" (labeled simulation). */
  kind: "live" | "demo";
  modelId: string;
  promptVersionHash: string;
}

export type BoardMessageKind =
  | "system" // stage banners
  | "opening"
  | "argument"
  | "question" // agent → agent cross-examination
  | "answer"
  | "final"
  | "vote"
  | "user_question" // untrusted, from chat
  | "agent_reply"; // agent answering a user question

export interface BoardMessage {
  id: string;
  sessionId: string;
  seq: number;
  stage: SessionStage;
  kind: BoardMessageKind;
  agentId: AgentId | null; // null = system or user
  userWallet: string | null;
  refProposalId: string | null;
  body: string;
  at: string;
}

// ── execution ───────────────────────────────────────────────────────────────

export interface ExecutionIntent {
  id: string;
  proposalId: string;
  idempotencyKey: string;
  actionType: ActionType;
  asset: string;
  recipient: string | null;
  amountUsd: number;
  maxSlippageBps: number;
  expiresAt: string;
  simulated: boolean;
  status: "PENDING" | "SIMULATED" | "SUBMITTED" | "CONFIRMED" | "FAILED" | "ABORTED";
}

export interface Receipt {
  proposalId: string;
  txHash: string;
  chainId: number;
  blockNumber: number;
  timestamp: string;
  asset: string;
  amountUsd: number;
  recipient: string | null;
  agentVotes: AgentVote[];
  holderTally: HolderVoteTally | null;
  finalStatus: "EXECUTED" | "FAILED";
}
