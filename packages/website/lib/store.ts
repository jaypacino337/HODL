"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type AmmState,
  LAUNCH_MARKETS,
  applyBuy,
  applySell,
  freshAmmState,
  getMarket,
} from "@overbid/shared";

/**
 * Paper-trading state for demo mode: 10,000 demo USDG, live FPMM state per
 * market, and a demo House Pool position — all persisted in localStorage.
 * This is the exact AMM the contracts implement, so demo prices move the way
 * real ones will. Live mode (wallet + Robinhood Chain) replaces this store.
 */

export const STARTING_CASH = 10_000;
/** Pretend third-party TVL so pool math feels real in demo mode. */
export const POOL_BASE_TVL = 250_000;

export interface DemoState {
  cash: number;
  /** marketSlug -> outcomeIndex -> shares held */
  positions: Record<string, Record<number, number>>;
  amm: Record<string, AmmState>;
  /** demo House Pool */
  lpDeposited: number;
  tradeLog: Array<{
    at: number;
    slug: string;
    side: "buy" | "sell";
    outcome: string;
    usd: number;
    shares: number;
  }>;
}

const KEY = "overbid-demo-v1";

function initialState(): DemoState {
  const amm: Record<string, AmmState> = {};
  for (const m of LAUNCH_MARKETS) {
    amm[m.slug] = freshAmmState(m.initialPools, m.seedLiquidityUsd);
  }
  return { cash: STARTING_CASH, positions: {}, amm, lpDeposited: 0, tradeLog: [] };
}

function load(): DemoState {
  if (typeof window === "undefined") return initialState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as DemoState;
    // heal state if the market list changed since it was saved
    for (const m of LAUNCH_MARKETS) {
      if (!parsed.amm[m.slug]?.pools?.length) {
        parsed.amm[m.slug] = freshAmmState(m.initialPools, m.seedLiquidityUsd);
      }
    }
    return parsed;
  } catch {
    return initialState();
  }
}

function save(s: DemoState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage full/blocked — demo keeps running in memory */
  }
}

export function useDemo() {
  // Server render and first client render both use the pristine state, then
  // we hydrate from localStorage — no SSR mismatch.
  const [state, setState] = useState<DemoState>(initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setState(load());
    setReady(true);
  }, []);

  const mutate = useCallback((fn: (draft: DemoState) => void) => {
    setState((prev) => {
      const draft: DemoState = JSON.parse(JSON.stringify(prev));
      fn(draft);
      save(draft);
      return draft;
    });
  }, []);

  const buy = useCallback(
    (slug: string, outcomeIdx: number, usd: number): void => {
      mutate((d) => {
        if (usd <= 0 || usd > d.cash) return;
        const m = getMarket(slug);
        if (!m) return;
        const shares = applyBuy(d.amm[slug], outcomeIdx, usd);
        d.cash -= usd;
        d.positions[slug] = d.positions[slug] ?? {};
        d.positions[slug][outcomeIdx] = (d.positions[slug][outcomeIdx] ?? 0) + shares;
        d.tradeLog.unshift({
          at: Date.now(),
          slug,
          side: "buy",
          outcome: m.outcomes[outcomeIdx].label,
          usd,
          shares,
        });
        d.tradeLog = d.tradeLog.slice(0, 50);
      });
    },
    [mutate]
  );

  const sell = useCallback(
    (slug: string, outcomeIdx: number, shares: number): void => {
      mutate((d) => {
        const held = d.positions[slug]?.[outcomeIdx] ?? 0;
        if (shares <= 0 || shares > held + 1e-9) return;
        const m = getMarket(slug);
        if (!m) return;
        const usd = applySell(d.amm[slug], outcomeIdx, Math.min(shares, held));
        d.cash += usd;
        d.positions[slug][outcomeIdx] = held - shares;
        d.tradeLog.unshift({
          at: Date.now(),
          slug,
          side: "sell",
          outcome: m.outcomes[outcomeIdx].label,
          usd,
          shares,
        });
        d.tradeLog = d.tradeLog.slice(0, 50);
      });
    },
    [mutate]
  );

  const depositLp = useCallback(
    (usd: number): void => {
      mutate((d) => {
        if (usd <= 0 || usd > d.cash) return;
        d.cash -= usd;
        d.lpDeposited += usd;
      });
    },
    [mutate]
  );

  const withdrawLp = useCallback(
    (usd: number): void => {
      mutate((d) => {
        if (usd <= 0 || usd > d.lpDeposited) return;
        d.lpDeposited -= usd;
        d.cash += usd;
      });
    },
    [mutate]
  );

  const reset = useCallback((): void => {
    const fresh = initialState();
    save(fresh);
    setState(fresh);
  }, []);

  return { state, ready, buy, sell, depositLp, withdrawLp, reset };
}

/** Total fees the demo AMMs have accrued (all markets). */
export function totalFees(state: DemoState): { lp: number; creator: number; treasury: number } {
  let lp = 0;
  let creator = 0;
  let treasury = 0;
  for (const amm of Object.values(state.amm)) {
    lp += amm.feesLp;
    creator += amm.feesCreator;
    treasury += amm.feesTreasury;
  }
  return { lp, creator, treasury };
}
