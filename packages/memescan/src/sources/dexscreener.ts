import { TokenSnapshot } from "../types";

const BASE = "https://api.dexscreener.com";

export class LiveDataUnavailable extends Error {
  constructor(cause: string) {
    super(`DexScreener API unreachable: ${cause}`);
    this.name = "LiveDataUnavailable";
  }
}

async function getJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface ProfileEntry {
  chainId: string;
  tokenAddress: string;
  description?: string;
  links?: { url: string }[];
}

interface BoostEntry extends ProfileEntry {
  amount?: number;
  totalAmount?: number;
}

interface DexPair {
  chainId: string;
  pairAddress: string;
  url?: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  txns?: { h24?: { buys: number; sells: number } };
  volume?: { h24?: number };
  priceChange?: { h1?: number; h6?: number; h24?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { websites?: { url: string }[]; socials?: { url: string }[] };
  boosts?: { active?: number };
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function pairToSnapshot(p: DexPair, extra: Partial<TokenSnapshot>): TokenSnapshot {
  const links = [
    ...(p.info?.websites ?? []).map((w) => w.url),
    ...(p.info?.socials ?? []).map((s) => s.url),
    ...(extra.links ?? []),
  ];
  return {
    chainId: p.chainId,
    address: p.baseToken.address,
    name: p.baseToken.name,
    symbol: p.baseToken.symbol,
    priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
    liquidityUsd: num(p.liquidity?.usd),
    fdvUsd: num(p.fdv),
    marketCapUsd: num(p.marketCap),
    volume24hUsd: num(p.volume?.h24),
    priceChange: {
      h1: num(p.priceChange?.h1),
      h6: num(p.priceChange?.h6),
      h24: num(p.priceChange?.h24),
    },
    txns24h: p.txns?.h24
      ? { buys: p.txns.h24.buys ?? 0, sells: p.txns.h24.sells ?? 0 }
      : null,
    pairCreatedAt: num(p.pairCreatedAt),
    boostsActive: num(p.boosts?.active) ?? extra.boostsActive ?? 0,
    hasProfile: extra.hasProfile ?? false,
    description: extra.description,
    links: [...new Set(links)],
    url: p.url,
  };
}

/** Best (deepest-liquidity) pair per token. */
function bestPairs(pairs: DexPair[]): Map<string, DexPair> {
  const best = new Map<string, DexPair>();
  for (const p of pairs) {
    if (!p?.baseToken?.address) continue;
    const key = `${p.chainId}:${p.baseToken.address}`;
    const prev = best.get(key);
    if (!prev || (p.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) {
      best.set(key, p);
    }
  }
  return best;
}

/**
 * Pull the currently-promoted token set: latest profiles + top/latest boosts,
 * then resolve each token to its deepest pair for market data.
 */
export async function fetchTrendingTokens(limit = 60): Promise<TokenSnapshot[]> {
  let profiles: ProfileEntry[];
  let topBoosts: BoostEntry[];
  let latestBoosts: BoostEntry[];
  try {
    [profiles, topBoosts, latestBoosts] = await Promise.all([
      getJson<ProfileEntry[]>(`${BASE}/token-profiles/latest/v1`),
      getJson<BoostEntry[]>(`${BASE}/token-boosts/top/v1`),
      getJson<BoostEntry[]>(`${BASE}/token-boosts/latest/v1`),
    ]);
  } catch (err) {
    throw new LiveDataUnavailable(err instanceof Error ? err.message : String(err));
  }

  interface Seed {
    chainId: string;
    address: string;
    description?: string;
    links: string[];
    boosted: boolean;
    hasProfile: boolean;
  }
  const seeds = new Map<string, Seed>();
  const absorb = (entries: ProfileEntry[], boosted: boolean, hasProfile: boolean) => {
    for (const e of entries ?? []) {
      if (!e?.tokenAddress || !e?.chainId) continue;
      const key = `${e.chainId}:${e.tokenAddress}`;
      const seed = seeds.get(key) ?? {
        chainId: e.chainId,
        address: e.tokenAddress,
        links: [],
        boosted: false,
        hasProfile: false,
      };
      seed.boosted = seed.boosted || boosted;
      seed.hasProfile = seed.hasProfile || hasProfile;
      seed.description = seed.description ?? e.description;
      for (const l of e.links ?? []) if (l?.url) seed.links.push(l.url);
      seeds.set(key, seed);
    }
  };
  absorb(profiles, false, true);
  absorb(topBoosts, true, false);
  absorb(latestBoosts, true, false);

  const list = [...seeds.values()].slice(0, limit);

  // Resolve market data in batches of 30 addresses per chain.
  const byChain = new Map<string, Seed[]>();
  for (const s of list) {
    byChain.set(s.chainId, [...(byChain.get(s.chainId) ?? []), s]);
  }
  const pairs: DexPair[] = [];
  for (const [chainId, chainSeeds] of byChain) {
    for (let i = 0; i < chainSeeds.length; i += 30) {
      const addrs = chainSeeds.slice(i, i + 30).map((s) => s.address).join(",");
      try {
        const res = await getJson<DexPair[]>(`${BASE}/tokens/v1/${chainId}/${addrs}`);
        pairs.push(...(res ?? []));
      } catch {
        // A failed batch loses those tokens but shouldn't kill the scan.
      }
    }
  }

  const best = bestPairs(pairs);
  const out: TokenSnapshot[] = [];
  for (const s of list) {
    const p = best.get(`${s.chainId}:${s.address}`);
    if (!p) continue;
    out.push(
      pairToSnapshot(p, {
        description: s.description,
        links: s.links,
        hasProfile: s.hasProfile,
        boostsActive: s.boosted ? 1 : 0,
      })
    );
  }
  if (out.length === 0) {
    throw new LiveDataUnavailable("no pairs resolved from trending set");
  }
  return out;
}

/** Free-text pair search (used by --query, e.g. `--query jimothy`). */
export async function searchTokens(query: string, limit = 40): Promise<TokenSnapshot[]> {
  let res: { pairs?: DexPair[] };
  try {
    res = await getJson<{ pairs?: DexPair[] }>(
      `${BASE}/latest/dex/search?q=${encodeURIComponent(query)}`
    );
  } catch (err) {
    throw new LiveDataUnavailable(err instanceof Error ? err.message : String(err));
  }
  const best = bestPairs(res.pairs ?? []);
  return [...best.values()]
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    .slice(0, limit)
    .map((p) => pairToSnapshot(p, {}));
}
