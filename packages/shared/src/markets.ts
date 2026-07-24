import type { MarketDef } from "./types";
import { poolsForProbabilities } from "./amm";

/**
 * The five launch markets. All five are created by the protocol from approved
 * templates and seeded with House Pool liquidity — and because they are
 * protocol-created, their creator-fee cut flows straight back into the House
 * Pool. US cities only in v1: Parcl Labs covers US markets; Toronto (and other
 * non-US cities) wait on a licensed local index provider.
 */

export const SEED_PER_MARKET_USD = 10_000;

export const LAUNCH_MARKETS: MarketDef[] = [
  {
    slug: "hottest-market-2026",
    question: "Hottest housing market of 2026",
    tagline: "Which city's home-price index climbs the most this year?",
    description:
      "The flagship city race. Each outcome is a share in one city. At settlement, the city whose Parcl Labs price feed ($/sqft) posts the largest percentage gain from Jan 1 2026 to Dec 31 2026 wins, and its shares redeem the collateral at 1 USDG each. Every other share expires worthless.",
    category: "city-race",
    outcomes: [
      { id: "miami", label: "Miami", thesis: "Migration + limited supply keeps South Florida bid." },
      { id: "new-york", label: "New York", thesis: "Inventory drought in the five boroughs." },
      { id: "austin", label: "Austin", thesis: "The correction is over and tech hiring is back." },
      { id: "phoenix", label: "Phoenix", thesis: "Sun-belt demand without Austin's supply glut." },
      { id: "chicago", label: "Chicago", thesis: "Cheapest big-city index with steady grind up." },
    ],
    rule: {
      kind: "max-gain",
      metric: "Parcl Labs price feed ($/sqft)",
      source: "Parcl Labs API — metro price feeds (docs.parcllabs.com)",
      windowStart: "2026-01-01",
      windowEnd: "2026-12-31",
    },
    locksAt: "2026-12-31T23:59:59Z",
    settlesAt: "2027-01-15T00:00:00Z",
    status: "open",
    createdBy: "protocol",
    seedLiquidityUsd: SEED_PER_MARKET_USD,
    initialPools: poolsForProbabilities([0.29, 0.23, 0.17, 0.17, 0.14], SEED_PER_MARKET_USD),
  },
  {
    slug: "austin-vs-phoenix-q3-2026",
    question: "Austin vs Phoenix — Q3 head-to-head",
    tagline: "Which sun-belt index gains more (or falls less) this quarter?",
    description:
      "Straight head-to-head. Whichever city's Parcl Labs price feed posts the better percentage change from Jul 1 2026 to Sep 30 2026 wins — falling less counts as winning. Winning shares redeem at 1 USDG.",
    category: "head-to-head",
    outcomes: [
      { id: "austin", label: "Austin", thesis: "Post-correction base effects favor a bounce." },
      { id: "phoenix", label: "Phoenix", thesis: "Tighter inventory, steadier absorption." },
    ],
    rule: {
      kind: "max-gain",
      metric: "Parcl Labs price feed ($/sqft)",
      source: "Parcl Labs API — Austin & Phoenix metro price feeds",
      windowStart: "2026-07-01",
      windowEnd: "2026-09-30",
    },
    locksAt: "2026-09-30T23:59:59Z",
    settlesAt: "2026-10-07T00:00:00Z",
    status: "open",
    createdBy: "protocol",
    seedLiquidityUsd: SEED_PER_MARKET_USD,
    initialPools: poolsForProbabilities([0.46, 0.54], SEED_PER_MARKET_USD),
  },
  {
    slug: "manhattan-rent-august-2026",
    question: "Manhattan rent growth positive in August?",
    tagline: "Does the Manhattan rental index print a gain for August 2026?",
    description:
      "Binary market on the month. YES wins if the Manhattan rental index change from Aug 1 2026 to Aug 31 2026 is greater than zero; otherwise NO wins. Winning shares redeem at 1 USDG.",
    category: "binary",
    outcomes: [
      { id: "yes", label: "Yes", thesis: "Peak-season leasing and thin supply." },
      { id: "no", label: "No", thesis: "Late-summer softening after the spring pop." },
    ],
    rule: {
      kind: "positive",
      metric: "Manhattan rental index (monthly change)",
      source: "Parcl Labs API — New York rental price feed",
      windowStart: "2026-08-01",
      windowEnd: "2026-08-31",
    },
    locksAt: "2026-08-31T23:59:59Z",
    settlesAt: "2026-09-10T00:00:00Z",
    status: "open",
    createdBy: "protocol",
    seedLiquidityUsd: SEED_PER_MARKET_USD,
    initialPools: poolsForProbabilities([0.63, 0.37], SEED_PER_MARKET_USD),
  },
  {
    slug: "miami-plus-5-2026",
    question: "Miami up 5%+ in 2026?",
    tagline: "Over/under on the year's loudest market.",
    description:
      "Threshold market. YES wins if Miami's Parcl Labs price feed gains 5% or more from Jan 1 2026 to Dec 31 2026; otherwise NO wins. Winning shares redeem at 1 USDG.",
    category: "binary",
    outcomes: [
      { id: "yes", label: "Yes — +5% or more", thesis: "Cash buyers and condo scarcity keep it running." },
      { id: "no", label: "No — under +5%", thesis: "Insurance costs and rate drag cap the upside." },
    ],
    rule: {
      kind: "threshold",
      metric: "Parcl Labs price feed ($/sqft), full-year change",
      source: "Parcl Labs API — Miami metro price feed",
      windowStart: "2026-01-01",
      windowEnd: "2026-12-31",
      thresholdPct: 5,
    },
    locksAt: "2026-12-31T23:59:59Z",
    settlesAt: "2027-01-15T00:00:00Z",
    status: "open",
    createdBy: "protocol",
    seedLiquidityUsd: SEED_PER_MARKET_USD,
    initialPools: poolsForProbabilities([0.41, 0.59], SEED_PER_MARKET_USD),
  },
  {
    slug: "us-national-q3-2026",
    question: "US housing up this quarter?",
    tagline: "Does the national index finish Q3 2026 green?",
    description:
      "The macro dial. YES wins if the US national price feed change from Jul 1 2026 to Sep 30 2026 is greater than zero; otherwise NO wins. Winning shares redeem at 1 USDG.",
    category: "binary",
    outcomes: [
      { id: "yes", label: "Yes", thesis: "Rate cuts feed through to prices." },
      { id: "no", label: "No", thesis: "Affordability wall; seasonal Q3 fade." },
    ],
    rule: {
      kind: "positive",
      metric: "US national price feed (quarterly change)",
      source: "Parcl Labs API — US aggregate price feed",
      windowStart: "2026-07-01",
      windowEnd: "2026-09-30",
    },
    locksAt: "2026-09-30T23:59:59Z",
    settlesAt: "2026-10-07T00:00:00Z",
    status: "open",
    createdBy: "protocol",
    seedLiquidityUsd: SEED_PER_MARKET_USD,
    initialPools: poolsForProbabilities([0.55, 0.45], SEED_PER_MARKET_USD),
  },
];

export function getMarket(slug: string): MarketDef | undefined {
  return LAUNCH_MARKETS.find((m) => m.slug === slug);
}

/** Total House Pool capital committed to seeding the launch board. */
export const TOTAL_SEED_USD = SEED_PER_MARKET_USD * LAUNCH_MARKETS.length;
