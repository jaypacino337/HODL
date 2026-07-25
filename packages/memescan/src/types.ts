/** A trending token flattened to the fields the scanner cares about. */
export interface TokenSnapshot {
  chainId: string;
  address: string;
  name: string;
  symbol: string;
  priceUsd: number | null;
  liquidityUsd: number | null;
  fdvUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  priceChange: { h1: number | null; h6: number | null; h24: number | null };
  txns24h: { buys: number; sells: number } | null;
  /** Pair creation time, epoch ms. */
  pairCreatedAt: number | null;
  /** Active paid DexScreener boosts on the token. */
  boostsActive: number;
  /** Token has a filled-in DexScreener profile. */
  hasProfile: boolean;
  description?: string;
  /** Social / website links advertised by the token. */
  links: string[];
  /** DexScreener pair URL. */
  url?: string;
}

export type Severity = "info" | "warn" | "danger";

export interface RiskFlag {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
  points: number;
}

export type Verdict =
  | "AVOID"
  | "HIGH RISK"
  | "SKETCHY"
  | "DYOR"
  | "LOOKS CLEANER";

export interface RiskReport {
  token: TokenSnapshot;
  flags: RiskFlag[];
  /** 0 (nothing found) → 100 (run away). */
  score: number;
  verdict: Verdict;
}

export interface NarrativeStats {
  tokenCount: number;
  newTokens24h: number;
  totalVolume24hUsd: number;
  medianChange24h: number | null;
  avgRiskScore: number;
}

export interface NarrativeCluster {
  id: string;
  label: string;
  /** lexicon = a known meta; emergent = discovered from word frequency this scan. */
  kind: "lexicon" | "emergent";
  tokens: TokenSnapshot[];
  stats: NarrativeStats;
  /** Composite momentum score used for ranking. */
  momentum: number;
}

export interface ScanResult {
  generatedAt: number;
  source: "live" | "demo" | "search";
  query?: string;
  tokens: TokenSnapshot[];
  reports: RiskReport[];
  narratives: NarrativeCluster[];
  notes: string[];
}
