import type { ActionType, AgentId, Proposal, TreasurySnapshot } from "./types";

/**
 * Treasury policy — the public guardrails. Everything configurable, nothing
 * hardcoded into agent prompts. The same object is (1) shown verbatim on
 * /treasury and /docs, (2) enforced by the engine before a proposal may enter
 * debate, and (3) mirrored by the on-chain TreasuryExecutor limits.
 */

export interface TreasuryPolicy {
  version: string;
  /** USD that can never be spent (permanent reserve). */
  minPermanentReserveUsd: number;
  /** Hard cap per session across all executed proposals. */
  maxPerSessionUsd: number;
  maxPerDayUsd: number;
  /** Max share of total treasury in any single non-USDG asset, %. */
  maxExposurePerAssetPct: number;
  /** Assets proposals may reference. */
  assetAllowlist: string[];
  /** Recipients (beyond protocol-internal sinks) payments may go to. */
  recipientAllowlist: Array<{ address: string; label: string }>;
  maxSlippageBps: number;
  /** Proposals must expire within this window. */
  maxProposalLifetimeHours: number;
  /** Delay between PASSED and execution eligibility. */
  executionDelayMinutes: number;
  emergencyPaused: boolean;
  /** Action types that require 4/5 agent votes + holder ratification. */
  sensitiveActions: ActionType[];
  /** Normal agent-vote threshold (YES votes required of 5). */
  normalThreshold: number;
  sensitiveThreshold: number;
  /** Agent governance wallets — payments to these are always forbidden. */
  agentWallets: Partial<Record<AgentId, string>>;
}

export const DEFAULT_POLICY: TreasuryPolicy = {
  version: "policy-1.0.0",
  minPermanentReserveUsd: 25_000,
  maxPerSessionUsd: 20_000,
  maxPerDayUsd: 30_000,
  maxExposurePerAssetPct: 25,
  assetAllowlist: ["USDG", "ETH", "BOARD", "AAPLx", "TSLAx", "NVDAx", "SPYx"],
  recipientAllowlist: [],
  maxSlippageBps: 150,
  maxProposalLifetimeHours: 72,
  executionDelayMinutes: 60,
  emergencyPaused: false,
  sensitiveActions: ["ACQUIRE_STOCK_TOKEN", "FUND_DEVELOPMENT", "FUND_COMMUNITY"],
  normalThreshold: 3,
  sensitiveThreshold: 4,
  agentWallets: {},
};

/** Actions that move value to an external recipient. */
const RECIPIENT_ACTIONS: ActionType[] = ["FUND_DEVELOPMENT", "FUND_COMMUNITY"];
/** Actions that never spend (bookkeeping decisions). */
const NON_SPENDING: ActionType[] = ["RETAIN_RESERVE", "CARRY_FORWARD"];

export interface PolicyVerdict {
  ok: boolean;
  rule?: string;
  ruleText?: string;
}

const fail = (rule: string, ruleText: string): PolicyVerdict => ({ ok: false, rule, ruleText });

/**
 * Validate a proposal against policy + the verified snapshot. Returns the
 * exact public rule on failure so the UI can print
 * "REJECTED BY TREASURY POLICY — <rule>".
 */
export function validateProposal(
  policy: TreasuryPolicy,
  snapshot: TreasurySnapshot,
  p: Pick<Proposal, "actionType" | "asset" | "recipient" | "amountUsd" | "maxSlippageBps" | "expiresAt" | "agentId">,
  sessionSpentUsd = 0,
  daySpentUsd = 0
): PolicyVerdict {
  if (policy.emergencyPaused) {
    return fail("EMERGENCY_PAUSE", "Treasury actions are paused by emergency control.");
  }
  if (!policy.assetAllowlist.includes(p.asset)) {
    return fail("ASSET_ALLOWLIST", `Asset ${p.asset} is not on the approved asset allowlist.`);
  }
  if (p.maxSlippageBps > policy.maxSlippageBps) {
    return fail("MAX_SLIPPAGE", `Slippage ${p.maxSlippageBps}bps exceeds the ${policy.maxSlippageBps}bps policy maximum.`);
  }
  const lifetimeMs = new Date(p.expiresAt).getTime() - Date.now();
  if (!(lifetimeMs > 0)) {
    return fail("EXPIRED", "Proposal expiration is in the past.");
  }
  if (lifetimeMs > policy.maxProposalLifetimeHours * 3600_000) {
    return fail("MAX_LIFETIME", `Proposals must expire within ${policy.maxProposalLifetimeHours}h.`);
  }

  // recipients
  const agentAddrs = new Set(Object.values(policy.agentWallets).filter(Boolean).map((a) => a!.toLowerCase()));
  if (p.recipient && agentAddrs.has(p.recipient.toLowerCase())) {
    return fail("NO_AGENT_PAYMENTS", "Treasury payments to agent governance wallets are forbidden. No self-dealing.");
  }
  if (RECIPIENT_ACTIONS.includes(p.actionType)) {
    if (!p.recipient) {
      return fail("RECIPIENT_REQUIRED", `${p.actionType} requires an allowlisted recipient.`);
    }
    const allowed = policy.recipientAllowlist.some((r) => r.address.toLowerCase() === p.recipient!.toLowerCase());
    if (!allowed) {
      return fail("RECIPIENT_ALLOWLIST", `Recipient ${p.recipient} is not on the approved recipient allowlist.`);
    }
  } else if (p.recipient) {
    return fail("NO_RECIPIENT", `${p.actionType} does not pay an external recipient; recipient must be empty.`);
  }

  if (NON_SPENDING.includes(p.actionType)) {
    return p.amountUsd === 0 || p.amountUsd <= snapshot.availableUsd
      ? { ok: true }
      : fail("AMOUNT_AVAILABLE", "Retained amount exceeds available funds.");
  }

  // spending checks
  if (p.amountUsd <= 0) {
    return fail("AMOUNT_POSITIVE", "Spending proposals need a positive amount.");
  }
  if (p.amountUsd > snapshot.availableUsd) {
    return fail("AMOUNT_AVAILABLE", `Amount $${p.amountUsd.toLocaleString()} exceeds available funds $${snapshot.availableUsd.toLocaleString()}.`);
  }
  const afterSpend = snapshot.totalUsd - p.amountUsd;
  if (afterSpend < policy.minPermanentReserveUsd + snapshot.reservedLiabilitiesUsd) {
    return fail(
      "PERMANENT_RESERVE",
      `Spending would breach the $${policy.minPermanentReserveUsd.toLocaleString()} permanent reserve plus reserved liabilities.`
    );
  }
  if (sessionSpentUsd + p.amountUsd > policy.maxPerSessionUsd) {
    return fail("SESSION_LIMIT", `Session allocation cap is $${policy.maxPerSessionUsd.toLocaleString()}.`);
  }
  if (daySpentUsd + p.amountUsd > policy.maxPerDayUsd) {
    return fail("DAILY_LIMIT", `Daily allocation cap is $${policy.maxPerDayUsd.toLocaleString()}.`);
  }
  if (p.actionType === "ACQUIRE_STOCK_TOKEN" || p.actionType === "ADD_LIQUIDITY") {
    const existing = snapshot.balances.find((b) => b.symbol === p.asset)?.usdValue ?? 0;
    const exposurePct = ((existing + p.amountUsd) / snapshot.totalUsd) * 100;
    if (exposurePct > policy.maxExposurePerAssetPct) {
      return fail(
        "ASSET_EXPOSURE",
        `Position would be ${exposurePct.toFixed(1)}% of treasury; the per-asset cap is ${policy.maxExposurePerAssetPct}%.`
      );
    }
  }
  return { ok: true };
}

/** YES votes needed for this action type. */
export function requiredYesVotes(policy: TreasuryPolicy, actionType: ActionType): number {
  return policy.sensitiveActions.includes(actionType) ? policy.sensitiveThreshold : policy.normalThreshold;
}

/** Whether a passed proposal must also clear holder ratification. */
export function needsHolderRatification(policy: TreasuryPolicy, actionType: ActionType): boolean {
  return policy.sensitiveActions.includes(actionType);
}
