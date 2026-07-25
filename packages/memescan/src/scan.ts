import * as fs from "fs";
import * as path from "path";
import { clusterNarratives } from "./narratives";
import { scoreAll } from "./risk";
import { fetchTrendingTokens, searchTokens, LiveDataUnavailable } from "./sources/dexscreener";
import { fetchRugSummary, RugSummary } from "./sources/rugcheck";
import { ScanResult, TokenSnapshot } from "./types";

export interface ScanOptions {
  /** Force the bundled demo snapshot (no network). */
  demo?: boolean;
  /** Scan a specific idea/narrative instead of the trending set. */
  query?: string;
  /** Max tokens to pull in live mode. */
  limit?: number;
  /** Skip RugCheck on-chain lookups. */
  noRugcheck?: boolean;
  /** Fail instead of falling back to demo data when live APIs are down. */
  liveOnly?: boolean;
}

interface DemoToken extends Omit<TokenSnapshot, "pairCreatedAt"> {
  ageHours: number;
}

export function loadDemoTokens(now = Date.now()): TokenSnapshot[] {
  const file = path.join(__dirname, "..", "fixtures", "demo.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { tokens: DemoToken[] };
  return raw.tokens.map(({ ageHours, ...t }) => ({
    ...t,
    pairCreatedAt: now - ageHours * 3_600_000,
  }));
}

export async function runScan(opts: ScanOptions = {}): Promise<ScanResult> {
  const now = Date.now();
  const notes: string[] = [];
  let tokens: TokenSnapshot[];
  let source: ScanResult["source"];

  if (opts.demo) {
    tokens = loadDemoTokens(now);
    source = "demo";
    notes.push("Demo mode: bundled fictional snapshot, no live data.");
  } else {
    try {
      tokens = opts.query
        ? await searchTokens(opts.query, opts.limit ?? 40)
        : await fetchTrendingTokens(opts.limit ?? 60);
      source = opts.query ? "search" : "live";
    } catch (err) {
      if (opts.liveOnly || !(err instanceof LiveDataUnavailable)) throw err;
      tokens = loadDemoTokens(now);
      source = "demo";
      notes.push(
        `LIVE DATA UNAVAILABLE (${err.message}) — showing the bundled DEMO snapshot instead. ` +
          "Every token below is fictional."
      );
    }
  }

  // RugCheck enrichment: Solana only, top-20 by volume to stay polite.
  const rugByAddress = new Map<string, RugSummary | null>();
  if (source !== "demo" && !opts.noRugcheck) {
    const solTokens = tokens
      .filter((t) => t.chainId === "solana")
      .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
      .slice(0, 20);
    const results = await Promise.all(
      solTokens.map(async (t) => [t.address, await fetchRugSummary(t.address)] as const)
    );
    let hits = 0;
    for (const [addr, rug] of results) {
      rugByAddress.set(addr, rug);
      if (rug) hits++;
    }
    if (solTokens.length > 0) {
      notes.push(`RugCheck on-chain reports fetched for ${hits}/${solTokens.length} Solana tokens.`);
    }
  }

  const reports = scoreAll(tokens, rugByAddress, now);
  const narratives = clusterNarratives(tokens, reports, now);

  return {
    generatedAt: now,
    source,
    query: opts.query,
    tokens,
    reports,
    narratives,
    notes,
  };
}
