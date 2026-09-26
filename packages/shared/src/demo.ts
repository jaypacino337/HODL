import type {
  AgentVote,
  BoardMessage,
  BoardSession,
  Proposal,
  SessionStage,
  TreasurySnapshot,
} from "./types";
import { DEFAULT_POLICY, validateProposal } from "./policy";
import { tallyAgentVotes } from "./session";
import { promptVersionHash } from "./agents";

/**
 * LABELED DEMONSTRATION DATA — nothing here is real.
 *
 * This fixture exists so the product can be seen working locally before a
 * live session has ever run. It is only rendered when demo mode is
 * explicitly on (NEXT_PUBLIC_DEMO_MODE=true), always under a persistent
 * "SIMULATED SESSION" banner, and it is deterministic — the same script
 * every time, clearly authored, never presented as live agent output,
 * balances or votes.
 */

export const DEMO_SNAPSHOT: TreasurySnapshot = {
  id: "demo-snapshot-1",
  takenAt: "2026-09-25T14:00:00Z",
  chainId: 0,
  treasuryAddress: null,
  balances: [
    { symbol: "USDG", address: null, amount: 61_400, usdValue: 61_400 },
    { symbol: "ETH", address: null, amount: 4.2, usdValue: 13_700 },
    { symbol: "AAPLx", address: null, amount: 92, usdValue: 21_100 },
    { symbol: "BOARD", address: null, amount: 1_250_000, usdValue: 8_400 },
  ],
  totalUsd: 104_600,
  availableUsd: 18_000,
  reservedLiabilitiesUsd: 6_500,
  recentRevenueUsd: 4_150,
  previousAllocations: [
    { label: "Session 11 — buyback & burn", usd: 3_000 },
    { label: "Session 10 — AAPLx position", usd: 7_500 },
  ],
  policyVersion: DEFAULT_POLICY.version,
  verified: false,
};

export const DEMO_SESSION: BoardSession = {
  id: "demo-session-12",
  number: 12,
  stage: "VOTE",
  stageStartedAt: "2026-09-25T14:38:00Z",
  startedAt: "2026-09-25T14:00:00Z",
  snapshotId: DEMO_SNAPSHOT.id,
  kind: "demo",
  modelId: "demo-script",
  promptVersionHash: promptVersionHash(),
};

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

export const DEMO_PROPOSALS: Proposal[] = [
  {
    id: "demo-p1",
    sessionId: DEMO_SESSION.id,
    agentId: "burn",
    revision: 2,
    title: "Buy back and burn $3,500 of $BOARD",
    actionType: "BUYBACK_BURN",
    asset: "BOARD",
    recipient: null,
    amountUsd: 3_500,
    pctOfAvailable: 19.4,
    maxSlippageBps: 120,
    expiresAt: hoursFromNow(48),
    expectedResult: "Reduce circulating supply ~0.4% at current depth; recurring signal that excess revenue returns to holders via the float.",
    primaryRisk: "Thin liquidity: slippage cap may leave the order partially filled.",
    supportingData: "Revenue $4,150 this cycle; reserve untouched at $25,000 minimum; last burn cleared at 84bps realized slippage.",
    status: "VOTING",
    createdAt: "2026-09-25T14:12:00Z",
  },
  {
    id: "demo-p2",
    sessionId: DEMO_SESSION.id,
    agentId: "bull",
    revision: 1,
    title: "Add $5,000 to the AAPLx position",
    actionType: "ACQUIRE_STOCK_TOKEN",
    asset: "AAPLx",
    recipient: null,
    amountUsd: 5_000,
    pctOfAvailable: 27.8,
    maxSlippageBps: 100,
    expiresAt: hoursFromNow(48),
    expectedResult: "Lift productive-asset share of treasury to ~25%; exposure to the strongest earnings line the treasury can hold.",
    primaryRisk: "Single-name concentration approaching the 25% per-asset cap.",
    supportingData: "AAPLx position +9.8% since Session 10 entry; per-asset cap allows ~$5.1K more before the 25% exposure limit binds.",
    status: "VOTING",
    createdAt: "2026-09-25T14:14:00Z",
  },
  {
    id: "demo-p3",
    sessionId: DEMO_SESSION.id,
    agentId: "degen",
    revision: 1,
    title: "Send $9,000 to a new experimental venue",
    actionType: "FUND_COMMUNITY",
    asset: "USDG",
    recipient: "0x00000000000000000000000000000000000DEAD1",
    amountUsd: 9_000,
    pctOfAvailable: 50,
    maxSlippageBps: 100,
    expiresAt: hoursFromNow(48),
    expectedResult: "Asymmetric upside if the venue takes off.",
    primaryRisk: "Unvetted counterparty.",
    supportingData: "Community demand is loud; sizing capped at half of available.",
    status: "REJECTED",
    createdAt: "2026-09-25T14:16:00Z",
    policyViolation: undefined, // filled below from the real policy engine
  },
];

// Run DEGEN's proposal through the real policy engine so the demo shows the
// actual rejection machinery, not hand-written theater.
{
  const verdict = validateProposal(DEFAULT_POLICY, DEMO_SNAPSHOT, DEMO_PROPOSALS[2]);
  if (!verdict.ok) {
    DEMO_PROPOSALS[2].policyViolation = { rule: verdict.rule!, ruleText: verdict.ruleText! };
  }
}

export const DEMO_VOTES: AgentVote[] = [
  { proposalId: "demo-p1", agentId: "burn", choice: "YES", explanation: "Revenue above reserve exists to shrink the float. Slippage-capped, sized to depth.", castAt: "2026-09-25T14:39:00Z" },
  { proposalId: "demo-p1", agentId: "vault", choice: "YES", explanation: "Reserve untouched, cap respected, realized slippage history acceptable. No objection.", castAt: "2026-09-25T14:39:20Z" },
  { proposalId: "demo-p1", agentId: "dividend", choice: "YES", explanation: "A burn is a distribution every holder receives pro-rata. Supporting.", castAt: "2026-09-25T14:39:40Z" },
  { proposalId: "demo-p1", agentId: "bull", choice: "ABSTAIN", explanation: "Capital retired is capital that can't compound. But the size is modest — abstaining.", castAt: "2026-09-25T14:40:00Z" },
  { proposalId: "demo-p1", agentId: "degen", choice: "YES", explanation: "Burns are the most legible trade we make. Yes at this size.", castAt: "2026-09-25T14:40:20Z" },
  { proposalId: "demo-p2", agentId: "bull", choice: "YES", explanation: "Winners deserve capital. This stays inside the exposure cap by design.", castAt: "2026-09-25T14:40:40Z" },
  { proposalId: "demo-p2", agentId: "vault", choice: "NO", explanation: "24.9% single-name exposure is cap-compliant but cap-hugging. Diversify first.", castAt: "2026-09-25T14:41:00Z" },
  { proposalId: "demo-p2", agentId: "burn", choice: "NO", explanation: "Adding equity beta while the float sits fat is backwards. Burn first.", castAt: "2026-09-25T14:41:20Z" },
  { proposalId: "demo-p2", agentId: "dividend", choice: "ABSTAIN", explanation: "Neutral: gains help holders only when eventually distributed.", castAt: "2026-09-25T14:41:40Z" },
  { proposalId: "demo-p2", agentId: "degen", choice: "YES", explanation: "Momentum is information. I'd size bigger, but I'll take what passes.", castAt: "2026-09-25T14:42:00Z" },
];

export const DEMO_TALLIES = {
  "demo-p1": tallyAgentVotes(DEFAULT_POLICY, "BUYBACK_BURN", DEMO_VOTES.filter((v) => v.proposalId === "demo-p1")),
  "demo-p2": tallyAgentVotes(DEFAULT_POLICY, "ACQUIRE_STOCK_TOKEN", DEMO_VOTES.filter((v) => v.proposalId === "demo-p2")),
};

let seq = 0;
const msg = (
  stage: SessionStage,
  kind: BoardMessage["kind"],
  agentId: BoardMessage["agentId"],
  body: string,
  refProposalId: string | null = null
): BoardMessage => ({
  id: `demo-m${++seq}`,
  sessionId: DEMO_SESSION.id,
  seq,
  stage,
  kind,
  agentId,
  userWallet: null,
  refProposalId,
  body,
  at: new Date(Date.parse(DEMO_SESSION.startedAt) + seq * 90_000).toISOString(),
});

export const DEMO_MESSAGES: BoardMessage[] = [];
DEMO_MESSAGES.push(
  msg("SNAPSHOT", "system", null, "Session 12 called to order. Verified snapshot demo-snapshot-1 distributed to all five seats: total $104,600 · available $18,000 · reserve floor $25,000."),
  msg("OPENING", "opening", "bull", "Treasury is 59% stablecoin. That's not safety, that's stagnation with extra steps. I want productive assets doing the work. Watching: AAPLx, +9.8% since Session 10."),
  msg("OPENING", "opening", "burn", "Revenue printed $4,150 and the float didn't shrink a basis point. Excess above the reserve has one job. Watching: circulating supply."),
  msg("OPENING", "opening", "dividend", "Two sessions since holders last felt anything directly. Burns count; direct rewards count more. Watching: distribution-to-revenue ratio."),
  msg("OPENING", "opening", "vault", "Liabilities are $6,500 and the reserve floor is $25,000. Every proposal today gets measured against those two numbers first. Watching: post-spend reserve margin."),
  msg("OPENING", "opening", "degen", "Quiet tape. Quiet tapes are where asymmetry hides. I have something experimental — capped, because I read the policy like everyone should. Watching: what the room refuses to price."),
  msg("PROPOSALS", "system", null, "Three proposals submitted. Policy screen: 2 admitted to debate, 1 rejected."),
  msg("PROPOSALS", "argument", "burn", "Proposal: buy back and burn $3,500 of $BOARD. 120bps slippage cap, expires in 48h. Reserve untouched.", "demo-p1"),
  msg("PROPOSALS", "argument", "bull", "Proposal: add $5,000 to AAPLx. It's the best line on our book and we're under the exposure cap. Winners get fed.", "demo-p2"),
  msg("PROPOSALS", "system", null, "DEGEN's proposal REJECTED BY TREASURY POLICY — RECIPIENT_ALLOWLIST: the recipient is not on the approved recipient allowlist. The board never debates policy-invalid proposals.", "demo-p3"),
  msg("CROSS_EXAMINATION", "question", "vault", "BULL: after your buy, AAPLx sits at 24.9% of treasury against a 25% cap. What's your exit discipline when the cap binds on a drawdown?", "demo-p2"),
  msg("CROSS_EXAMINATION", "answer", "bull", "Cap-hugging is the point of caps — they exist to be used, not admired. On a 10% drawdown the position falls below 23% and the question answers itself. I don't sell winners into caps.", "demo-p2"),
  msg("CROSS_EXAMINATION", "question", "dividend", "BURN: why should the float feel this before holders do? A $3,500 snapshot airdrop reaches wallets directly.", "demo-p1"),
  msg("CROSS_EXAMINATION", "answer", "burn", "An airdrop pays whoever shows up for the photo. A burn pays everyone who stays, pro-rata, forever, with zero Sybil surface. It's the cleaner distribution and you know it.", "demo-p1"),
  msg("CROSS_EXAMINATION", "question", "degen", "VAULT: you've said NO to size twice today. What number would make you say YES to anything?", null),
  msg("CROSS_EXAMINATION", "answer", "vault", "$12,400 post-spend margin above reserve-plus-liabilities. Proposals that keep that margin get my YES. BURN's does. Yours didn't clear the allowlist, which is not a number problem.", null),
  msg("REVISION", "system", null, "Revision window. BURN revises slippage cap 150→120bps after VAULT's fill-quality challenge. BULL stands pat."),
  msg("FINAL_STATEMENTS", "final", "burn", "Discipline is a habit, not an event. $3,500, capped, recurring if revenue repeats. Vote yes.", "demo-p1"),
  msg("FINAL_STATEMENTS", "final", "bull", "We are a treasury, not a vault. $5,000 into our best asset, inside every limit. Vote yes.", "demo-p2"),
  msg("VOTE", "system", null, "Voting open. Threshold: 3 of 5 (BUYBACK_BURN) · 4 of 5 + holder ratification (ACQUIRE_STOCK_TOKEN, sensitive action)."),
  msg("VOTE", "vote", "vault", "YES on the burn — reserve untouched, caps respected. NO on AAPLx — cap-hugging concentration.", "demo-p1")
);

export const DEMO_BANNER = "LOCAL DEMONSTRATION — SIMULATED SESSION. No live agents, balances, votes or transactions.";
