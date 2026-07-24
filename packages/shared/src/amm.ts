import type { AmmState, Quote } from "./types";

/**
 * OVERBID's market maker is an n-outcome fixed-product AMM (the same design
 * as Gnosis' FixedProductMarketMaker, which Polymarket's early markets used):
 *
 *   invariant:  ∏ pools[i] = k
 *
 * Buying outcome i with USDG mints a complete set (1 share of EVERY outcome
 * per 1 USDG, fully collateralized), adds it to the pools, then withdraws
 * enough outcome-i shares to restore the invariant. Implied probability of
 * outcome i is proportional to 1 / pools[i].
 *
 * This file is the reference implementation the website's paper-trading mode
 * runs on; contracts/src/OverbidMarket.sol mirrors it in fixed-point.
 */

/** Trading fee, taken from every buy/sell, in USDG terms. */
export const TRADE_FEE = 0.02;

/** Where each fee goes. LPs earn most of it — they carry the market risk. */
export const FEE_SPLIT = {
  /** House Pool LPs. */
  lp: 0.7,
  /** Market creator. For protocol-created markets this cut is routed BACK
   * into the House Pool — creator fees fund the liquidity pool. */
  creator: 0.1,
  /** Protocol treasury: seeds new markets, pays oracle costs, funds rewards. */
  treasury: 0.2,
} as const;

export function impliedProbabilities(pools: number[]): number[] {
  // p_i ∝ ∏_{j≠i} pools[j]  ⇔  p_i ∝ 1 / pools[i]
  const inv = pools.map((b) => 1 / b);
  const sum = inv.reduce((a, x) => a + x, 0);
  return inv.map((x) => x / sum);
}

export function impliedProbability(pools: number[], i: number): number {
  return impliedProbabilities(pools)[i];
}

/** Marginal price of one share of outcome i, in USDG (equals its probability). */
export function spotPrice(pools: number[], i: number): number {
  return impliedProbability(pools, i);
}

function splitFee(state: AmmState, fee: number): void {
  state.feesLp += fee * FEE_SPLIT.lp;
  state.feesCreator += fee * FEE_SPLIT.creator;
  state.feesTreasury += fee * FEE_SPLIT.treasury;
}

/** Shares of outcome i received for `investment` USDG (fee included). */
export function quoteBuy(pools: number[], i: number, investment: number): Quote {
  if (investment <= 0) return { amountOut: 0, avgPrice: 0, fee: 0, newProbability: impliedProbability(pools, i), priceImpact: 0 };
  const fee = investment * TRADE_FEE;
  const a = investment - fee;
  const k = pools.reduce((p, b) => p * b, 1);
  // every pool receives `a` from the minted complete set…
  const grown = pools.map((b) => b + a);
  // …then pool i is drained back to restore ∏ = k
  const othersProduct = grown.reduce((p, b, j) => (j === i ? p : p * b), 1);
  const newPoolI = k / othersProduct;
  const amountOut = pools[i] + a - newPoolI;
  const before = impliedProbability(pools, i);
  const newPools = grown.map((b, j) => (j === i ? newPoolI : b));
  const after = impliedProbability(newPools, i);
  return {
    amountOut,
    avgPrice: investment / amountOut,
    fee,
    newProbability: after,
    priceImpact: after - before,
  };
}

/** USDG received for selling `shares` of outcome i (fee included). */
export function quoteSell(pools: number[], i: number, shares: number): Quote {
  if (shares <= 0) return { amountOut: 0, avgPrice: 0, fee: 0, newProbability: impliedProbability(pools, i), priceImpact: 0 };
  const k = pools.reduce((p, b) => p * b, 1);
  // Find gross return r: seller deposits `shares` of i, the AMM burns r
  // complete sets for collateral, invariant holds:
  //   (pools[i] + shares − r) · ∏_{j≠i}(pools[j] − r) = k
  // f(r) is monotonically decreasing on the valid range — bisect.
  const rMax = Math.min(...pools.filter((_, j) => j !== i), pools[i] + shares);
  let lo = 0;
  let hi = rMax * 0.999999;
  const f = (r: number) =>
    pools.reduce((p, b, j) => p * (j === i ? b + shares - r : b - r), 1) - k;
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  const gross = lo;
  const fee = gross * TRADE_FEE;
  const amountOut = gross - fee;
  const newPools = pools.map((b, j) => (j === i ? b + shares - gross : b - gross));
  const after = impliedProbability(newPools, i);
  const before = impliedProbability(pools, i);
  return {
    amountOut,
    avgPrice: amountOut / shares,
    fee,
    newProbability: after,
    priceImpact: after - before,
  };
}

/** Apply a buy to AMM state; returns shares received. */
export function applyBuy(state: AmmState, i: number, investment: number): number {
  const q = quoteBuy(state.pools, i, investment);
  const a = investment - q.fee;
  state.pools = state.pools.map((b, j) => (j === i ? b + a - q.amountOut : b + a));
  state.collateral += a;
  state.trades += 1;
  splitFee(state, q.fee);
  return q.amountOut;
}

/** Apply a sell to AMM state; returns USDG received. */
export function applySell(state: AmmState, i: number, shares: number): number {
  const q = quoteSell(state.pools, i, shares);
  const gross = q.amountOut + q.fee;
  state.pools = state.pools.map((b, j) => (j === i ? b + shares - gross : b - gross));
  state.collateral -= gross;
  state.trades += 1;
  splitFee(state, q.fee);
  return q.amountOut;
}

/** Pool balances that produce the given implied probabilities with roughly
 * `seedUsd` of seeded depth. Used to initialize the launch markets. */
export function poolsForProbabilities(probs: number[], seedUsd: number): number[] {
  // b_i = K / p_i ; pick K so average pool ≈ seedUsd
  const invSum = probs.reduce((a, p) => a + 1 / p, 0);
  const K = (seedUsd * probs.length) / invSum;
  return probs.map((p) => Math.round((K / p) * 100) / 100);
}

export function freshAmmState(pools: number[], collateral: number): AmmState {
  return {
    pools: [...pools],
    collateral,
    feesLp: 0,
    feesCreator: 0,
    feesTreasury: 0,
    trades: 0,
  };
}
