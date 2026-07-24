/** Shared domain types for OVERBID — used by the website, the oracle worker,
 * and mirrored by the Solidity contracts in packages/contracts. */

/** A tradable outcome inside a market ("Miami", "Yes", …). */
export interface Outcome {
  /** Stable id, unique within the market (e.g. "miami"). */
  id: string;
  label: string;
  /** Short blurb shown in trading UI (why someone might buy this side). */
  thesis?: string;
}

export type MarketStatus = "open" | "locked" | "settled";

/** How a market resolves against index data. */
export interface SettlementRule {
  /**
   * - "max-gain":   outcome whose index gains the most %, start→end, wins
   * - "threshold":  binary — Yes wins if the metric change ≥ thresholdPct
   * - "positive":   binary — Yes wins if the metric change > 0
   */
  kind: "max-gain" | "threshold" | "positive";
  /** Metric measured, e.g. "Parcl Labs price feed ($/sqft)". */
  metric: string;
  /** Index provider + feed(s), for the market page and the oracle worker. */
  source: string;
  /** Measurement window start/end (ISO date). */
  windowStart: string;
  windowEnd: string;
  /** Only for kind = "threshold" (e.g. 5 for +5%). */
  thresholdPct?: number;
}

/** A market definition. On-chain this corresponds to one OverbidMarket. */
export interface MarketDef {
  slug: string;
  question: string;
  /** One-line subtitle for cards. */
  tagline: string;
  description: string;
  category: "city-race" | "head-to-head" | "binary";
  outcomes: Outcome[];
  rule: SettlementRule;
  /** ISO timestamp trading stops (usually windowEnd). */
  locksAt: string;
  /** ISO timestamp settlement is expected. */
  settlesAt: string;
  status: MarketStatus;
  /** "protocol" for the five launch markets we fund; else a creator address. */
  createdBy: string;
  /** USDG the House Pool seeded this market with. */
  seedLiquidityUsd: number;
  /**
   * Current AMM pool balances (outcome-share inventory), same order as
   * `outcomes`. Implied probability of outcome i is proportional to 1/pool[i].
   */
  initialPools: number[];
}

/** Live AMM state for one market. */
export interface AmmState {
  /** Outcome-share balances held by the AMM, same order as market outcomes. */
  pools: number[];
  /** Total USDG collateral locked (complete sets minted). */
  collateral: number;
  /** Cumulative fees accrued, by destination. */
  feesLp: number;
  feesCreator: number;
  feesTreasury: number;
  /** Trade count, for display. */
  trades: number;
}

export interface Quote {
  /** Shares of the chosen outcome received (buy) or USDG received (sell). */
  amountOut: number;
  /** Average price paid per share, in USDG. */
  avgPrice: number;
  /** Total fee charged, in USDG. */
  fee: number;
  /** Implied probability of the outcome after the trade. */
  newProbability: number;
  priceImpact: number;
}

export interface IndexObservation {
  cityId: string;
  metric: string;
  observedAt: string;
  value: number;
}

export interface Settlement {
  marketSlug: string;
  winningOutcomeId: string;
  /** Per-outcome % change over the window that decided it. */
  changesPct: Record<string, number>;
  settledAt: string;
}
