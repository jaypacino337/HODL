import type { MarketDef, Settlement } from "@overbid/shared";
import { OracleDb } from "./db";

/** Map a market outcome to the feed it settles against. */
export function feedForOutcome(market: MarketDef, outcomeId: string): string {
  switch (market.slug) {
    case "hottest-market-2026":
    case "austin-vs-phoenix-q3-2026":
      return `parcl:price:${outcomeId}`; // outcome ids ARE city ids
    case "manhattan-rent-august-2026":
      return "parcl:rental:new-york";
    case "miami-plus-5-2026":
      return "parcl:price:miami";
    case "us-national-q3-2026":
      return "parcl:price:usa";
    default:
      throw new Error(`no feed mapping for market ${market.slug}`);
  }
}

interface WindowChange {
  feedId: string;
  startDate: string;
  startValue: number;
  endDate: string;
  endValue: number;
  changePct: number;
}

async function windowChange(db: OracleDb, feedId: string, market: MarketDef): Promise<WindowChange> {
  const start = await db.observationAtOrBefore(feedId, market.rule.windowStart);
  const end = await db.observationAtOrBefore(feedId, market.rule.windowEnd);
  if (!start || !end) throw new Error(`missing observations for ${feedId} in ${market.slug}`);
  if (end.date <= start.date) throw new Error(`window not elapsed for ${feedId} in ${market.slug}`);
  return {
    feedId,
    startDate: start.date,
    startValue: start.value,
    endDate: end.date,
    endValue: end.value,
    changePct: ((end.value - start.value) / start.value) * 100,
  };
}

/**
 * Deterministic settlement per the market's rule. Throws if required index
 * data isn't in the ledger yet — the loop retries on the next tick.
 */
export async function computeSettlement(
  db: OracleDb,
  market: MarketDef
): Promise<{ settlement: Settlement; evidence: Record<string, WindowChange> }> {
  const evidence: Record<string, WindowChange> = {};
  const changesPct: Record<string, number> = {};

  if (market.rule.kind === "max-gain") {
    // one feed per outcome; biggest % gain wins (falling less also wins)
    let winner: string | null = null;
    for (const o of market.outcomes) {
      const wc = await windowChange(db, feedForOutcome(market, o.id), market);
      evidence[o.id] = wc;
      changesPct[o.id] = wc.changePct;
      if (winner === null || wc.changePct > changesPct[winner]) winner = o.id;
    }
    return {
      settlement: {
        marketSlug: market.slug,
        winningOutcomeId: winner!,
        changesPct,
        settledAt: new Date().toISOString(),
      },
      evidence,
    };
  }

  // binary: single feed, yes/no on the measured change
  const feedId = feedForOutcome(market, market.outcomes[0].id);
  const wc = await windowChange(db, feedId, market);
  evidence["metric"] = wc;
  for (const o of market.outcomes) changesPct[o.id] = wc.changePct;

  const threshold = market.rule.kind === "threshold" ? market.rule.thresholdPct ?? 0 : 0;
  const yesWins = market.rule.kind === "threshold" ? wc.changePct >= threshold : wc.changePct > 0;
  const yesId = market.outcomes[0].id; // convention: outcome 0 is YES
  const noId = market.outcomes[1].id;

  return {
    settlement: {
      marketSlug: market.slug,
      winningOutcomeId: yesWins ? yesId : noId,
      changesPct,
      settledAt: new Date().toISOString(),
    },
    evidence,
  };
}
