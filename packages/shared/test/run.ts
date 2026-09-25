import assert from "node:assert";
import {
  ACTION_TYPES,
  AGENTS,
  DEFAULT_POLICY,
  DEMO_PROPOSALS,
  ProposalDraftSchema,
  TOTAL_AGENT_ALLOCATION_PCT,
  VoteSchema,
  canTransition,
  needsHolderRatification,
  nextStage,
  parseAgentOutput,
  promptVersionHash,
  requiredYesVotes,
  sanitizeUserMessage,
  tallyAgentVotes,
  validateProposal,
  type AgentVote,
  type TreasurySnapshot,
} from "../src";

let passed = 0;
function t(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e}`);
    process.exitCode = 1;
  }
}

const snap: TreasurySnapshot = {
  id: "s",
  takenAt: new Date().toISOString(),
  chainId: 0,
  treasuryAddress: null,
  balances: [
    { symbol: "USDG", address: null, amount: 60_000, usdValue: 60_000 },
    { symbol: "AAPLx", address: null, amount: 90, usdValue: 21_000 },
  ],
  totalUsd: 100_000,
  availableUsd: 18_000,
  reservedLiabilitiesUsd: 5_000,
  recentRevenueUsd: 0,
  previousAllocations: [],
  policyVersion: DEFAULT_POLICY.version,
  verified: false,
};

const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
const base = {
  actionType: "BUYBACK_BURN" as const,
  asset: "BOARD",
  recipient: null,
  amountUsd: 2_000,
  maxSlippageBps: 100,
  expiresAt: hours(24),
  agentId: "burn" as const,
};

console.log("policy engine");
t("valid proposal passes", () => assert.ok(validateProposal(DEFAULT_POLICY, snap, base).ok));
t("asset allowlist enforced", () => {
  const v = validateProposal(DEFAULT_POLICY, snap, { ...base, asset: "SCAMCOIN" });
  assert.equal(v.rule, "ASSET_ALLOWLIST");
});
t("slippage cap enforced", () => {
  assert.equal(validateProposal(DEFAULT_POLICY, snap, { ...base, maxSlippageBps: 500 }).rule, "MAX_SLIPPAGE");
});
t("expiration window enforced (too long)", () => {
  assert.equal(validateProposal(DEFAULT_POLICY, snap, { ...base, expiresAt: hours(200) }).rule, "MAX_LIFETIME");
});
t("expired proposal rejected", () => {
  assert.equal(validateProposal(DEFAULT_POLICY, snap, { ...base, expiresAt: hours(-1) }).rule, "EXPIRED");
});
t("available-funds limit enforced", () => {
  assert.equal(validateProposal(DEFAULT_POLICY, snap, { ...base, amountUsd: 19_000 }).rule, "AMOUNT_AVAILABLE");
});
t("permanent reserve protected", () => {
  const poorSnap = { ...snap, totalUsd: 31_000, availableUsd: 10_000 };
  assert.equal(validateProposal(DEFAULT_POLICY, poorSnap, { ...base, amountUsd: 5_000 }).rule, "PERMANENT_RESERVE");
});
t("session spending limit enforced", () => {
  assert.equal(validateProposal(DEFAULT_POLICY, snap, { ...base, amountUsd: 6000 }, 15_000, 0).rule, "SESSION_LIMIT");
});
t("daily spending limit enforced", () => {
  assert.equal(validateProposal(DEFAULT_POLICY, snap, { ...base, amountUsd: 6000 }, 0, 26_000).rule, "DAILY_LIMIT");
});
t("per-asset exposure cap enforced", () => {
  const v = validateProposal(DEFAULT_POLICY, snap, {
    ...base,
    actionType: "ACQUIRE_STOCK_TOKEN",
    asset: "AAPLx",
    amountUsd: 8_000,
  });
  assert.equal(v.rule, "ASSET_EXPOSURE"); // 21k+8k = 29% > 25%
});
t("recipient allowlist enforced", () => {
  const v = validateProposal(DEFAULT_POLICY, snap, {
    ...base,
    actionType: "FUND_COMMUNITY",
    asset: "USDG",
    recipient: "0x1111111111111111111111111111111111111111",
  });
  assert.equal(v.rule, "RECIPIENT_ALLOWLIST");
});
t("payments to agent wallets always forbidden", () => {
  const policy = {
    ...DEFAULT_POLICY,
    agentWallets: { degen: "0x2222222222222222222222222222222222222222" },
    recipientAllowlist: [{ address: "0x2222222222222222222222222222222222222222", label: "sneaky" }],
  };
  const v = validateProposal(policy, snap, {
    ...base,
    actionType: "FUND_COMMUNITY",
    asset: "USDG",
    recipient: "0x2222222222222222222222222222222222222222",
  });
  assert.equal(v.rule, "NO_AGENT_PAYMENTS");
});
t("emergency pause blocks everything", () => {
  const v = validateProposal({ ...DEFAULT_POLICY, emergencyPaused: true }, snap, base);
  assert.equal(v.rule, "EMERGENCY_PAUSE");
});
t("demo DEGEN proposal is rejected by the real engine", () => {
  assert.equal(DEMO_PROPOSALS[2].policyViolation?.rule, "RECIPIENT_ALLOWLIST");
});

console.log("voting");
const vote = (agentId: AgentVote["agentId"], choice: AgentVote["choice"]): AgentVote => ({
  proposalId: "p",
  agentId,
  choice,
  explanation: "x",
  castAt: new Date().toISOString(),
});
t("normal threshold is 3/5", () => assert.equal(requiredYesVotes(DEFAULT_POLICY, "BUYBACK_BURN"), 3));
t("sensitive threshold is 4/5", () => assert.equal(requiredYesVotes(DEFAULT_POLICY, "ACQUIRE_STOCK_TOKEN"), 4));
t("3 YES passes a normal action", () => {
  const r = tallyAgentVotes(DEFAULT_POLICY, "BUYBACK_BURN", [vote("bull", "YES"), vote("burn", "YES"), vote("vault", "YES"), vote("degen", "NO"), vote("dividend", "ABSTAIN")]);
  assert.ok(r.passed);
  assert.equal(r.nextStatus, "AWAITING_EXECUTION");
});
t("3 YES fails a sensitive action; 4 passes to holder vote", () => {
  const three = tallyAgentVotes(DEFAULT_POLICY, "ACQUIRE_STOCK_TOKEN", [vote("bull", "YES"), vote("burn", "YES"), vote("vault", "YES")]);
  assert.ok(!three.passed);
  const four = tallyAgentVotes(DEFAULT_POLICY, "ACQUIRE_STOCK_TOKEN", [vote("bull", "YES"), vote("burn", "YES"), vote("vault", "YES"), vote("degen", "YES")]);
  assert.ok(four.passed);
  assert.equal(four.nextStatus, "AWAITING_HOLDER_VOTE");
  assert.ok(needsHolderRatification(DEFAULT_POLICY, "ACQUIRE_STOCK_TOKEN"));
});
t("duplicate votes from one agent are ignored", () => {
  const r = tallyAgentVotes(DEFAULT_POLICY, "BUYBACK_BURN", [vote("bull", "NO"), vote("bull", "YES"), vote("bull", "YES"), vote("burn", "YES"), vote("vault", "YES")]);
  assert.equal(r.yes, 2); // bull's first vote (NO) is final
  assert.ok(!r.passed);
});

console.log("proposal state machine");
t("legal transitions", () => {
  assert.ok(canTransition("DRAFT", "DEBATING"));
  assert.ok(canTransition("VOTING", "PASSED"));
  assert.ok(canTransition("AWAITING_HOLDER_VOTE", "AWAITING_EXECUTION"));
  assert.ok(canTransition("EXECUTING", "FAILED"));
  assert.ok(canTransition("FAILED", "AWAITING_EXECUTION")); // guarded retry
});
t("illegal transitions blocked", () => {
  assert.ok(!canTransition("EXECUTED", "EXECUTING"));
  assert.ok(!canTransition("DRAFT", "EXECUTED"));
  assert.ok(!canTransition("REJECTED", "VOTING"));
});
t("stage order moves forward and terminates", () => {
  assert.equal(nextStage("VOTE"), "HOLDER_RATIFICATION");
  assert.equal(nextStage("ADJOURNED"), "ADJOURNED");
});

console.log("schemas");
t("valid proposal draft parses", () => {
  const r = parseAgentOutput(ProposalDraftSchema, JSON.stringify({
    title: "Buy back $2,000",
    actionType: "BUYBACK_BURN",
    asset: "BOARD",
    recipient: null,
    amountUsd: 2000,
    pctOfAvailable: 11.1,
    maxSlippageBps: 100,
    expiresInHours: 48,
    expectedResult: "Supply down",
    primaryRisk: "Slippage",
    supportingData: "Revenue",
  }));
  assert.ok(r.ok);
});
t("free-form output rejected (never becomes calldata)", () => {
  assert.ok(!parseAgentOutput(ProposalDraftSchema, "Sure! I propose we buy $2000 of BOARD.").ok);
});
t("extra fields rejected (strict)", () => {
  const r = parseAgentOutput(VoteSchema, JSON.stringify({ choice: "YES", explanation: "ok", calldata: "0xdeadbeef" }));
  assert.ok(!r.ok);
});
t("code-fenced JSON tolerated", () => {
  const r = parseAgentOutput(VoteSchema, '```json\n{"choice":"NO","explanation":"reserve"}\n```');
  assert.ok(r.ok && r.value.choice === "NO");
});
t("all 8 action types covered", () => assert.equal(ACTION_TYPES.length, 8));

console.log("chat sanitization");
t("control chars, zero-width and length stripped", () => {
  const dirty = "hi\u0000​ there‮" + "x".repeat(900);
  const clean = sanitizeUserMessage(dirty);
  assert.ok(clean.length <= 500);
  assert.ok(!/[\u0000​]/.test(clean));
});

console.log("agents");
t("five agents, 1% each, 5% total, distinct seats", () => {
  assert.equal(AGENTS.length, 5);
  assert.ok(AGENTS.every((a) => a.lockedAllocationPct === 1));
  assert.equal(TOTAL_AGENT_ALLOCATION_PCT, 5);
  assert.equal(new Set(AGENTS.map((a) => a.seatIndex)).size, 5);
});
t("prompt version hash is stable and versioned", () => {
  assert.equal(promptVersionHash(), promptVersionHash());
  assert.ok(promptVersionHash().startsWith("mv1-"));
});

console.log(`\n${passed} assertions passed${process.exitCode ? " (WITH FAILURES)" : ""}`);
