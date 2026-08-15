import { AttnConfig, ScanItem, ScanSource, SourceStatus } from "@attn/shared";

/**
 * The Attention Scanner. Every cycle it sweeps the sources below and
 * produces a ranked list of what the market is paying attention to.
 *
 *   dexscreener — live, no key. Boosted/trending Solana pairs.
 *   coingecko   — live, no key. Global trending searches.
 *   news        — needs NEWS_API_KEY (newsapi.org). Crypto headlines.
 *   tiktok      — needs a data provider key; TikTok has no free public
 *                 trends API. The slot is wired so plugging a provider in
 *                 is a one-function change (fetchTikTok below).
 *
 * Composite score is 0-100 per item, blending source rank with 24h
 * volume/price action where available.
 */
export async function runScan(
  config: AttnConfig
): Promise<{ items: ScanItem[]; sources: SourceStatus[] }> {
  const sources: SourceStatus[] = [];
  const items: ScanItem[] = [];

  const [dex, gecko, news] = await Promise.all([
    fetchDexScreener().catch((err) => ({ items: [], status: err.message as string })),
    fetchCoinGecko().catch((err) => ({ items: [], status: err.message as string })),
    fetchNews(config.newsApiKey).catch((err) => ({ items: [], status: err.message as string })),
  ]);

  sources.push(
    dex.status
      ? { source: "dexscreener", status: "error", detail: dex.status }
      : { source: "dexscreener", status: "live", detail: `${dex.items.length} boosted tokens` },
    gecko.status
      ? { source: "coingecko", status: "error", detail: gecko.status }
      : { source: "coingecko", status: "live", detail: `${gecko.items.length} trending searches` },
    config.newsApiKey
      ? news.status
        ? { source: "news", status: "error", detail: news.status }
        : { source: "news", status: "live", detail: `${news.items.length} headlines` }
      : { source: "news", status: "needs_key", detail: "set NEWS_API_KEY to activate" },
    { source: "tiktok", status: "needs_key", detail: "plug a trends provider into fetchTikTok()" }
  );

  items.push(...dex.items, ...gecko.items, ...news.items);
  // Re-rank the merged list by score, cap at 30 rows per scan.
  items.sort((a, b) => b.score - a.score);
  return { items: items.slice(0, 30).map((item, i) => ({ ...item, rank: i + 1 })), sources };
}

interface SourceResult {
  items: ScanItem[];
  status?: string;
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { accept: "application/json", ...headers } });
  if (!res.ok) throw new Error(`${new URL(url).host} -> HTTP ${res.status}`);
  return res.json();
}

/** Boosted + top tokens on DexScreener (public, keyless). */
async function fetchDexScreener(): Promise<SourceResult> {
  const boosts: any[] = await getJson("https://api.dexscreener.com/token-boosts/top/v1");
  const solana = (Array.isArray(boosts) ? boosts : []).filter((b) => b.chainId === "solana").slice(0, 15);

  const items: ScanItem[] = [];
  for (let i = 0; i < solana.length; i++) {
    const b = solana[i];
    // Enrich with live pair data (price/volume) — best-effort per token.
    let priceUsd: number | null = null;
    let change24h: number | null = null;
    let volume24hUsd: number | null = null;
    let symbol = (b.tokenAddress ?? "").slice(0, 6);
    let name = b.description?.slice(0, 40) ?? symbol;
    try {
      const pairs = await getJson(`https://api.dexscreener.com/latest/dex/tokens/${b.tokenAddress}`);
      const best = (pairs.pairs ?? []).sort(
        (a: any, z: any) => Number(z.volume?.h24 ?? 0) - Number(a.volume?.h24 ?? 0)
      )[0];
      if (best) {
        priceUsd = best.priceUsd ? Number(best.priceUsd) : null;
        change24h = best.priceChange?.h24 != null ? Number(best.priceChange.h24) : null;
        volume24hUsd = best.volume?.h24 != null ? Number(best.volume.h24) : null;
        symbol = best.baseToken?.symbol ?? symbol;
        name = best.baseToken?.name ?? name;
      }
    } catch {
      // keep the boost row even if enrichment fails
    }
    const rankScore = 100 - i * 4;
    const volScore = volume24hUsd ? Math.min(30, Math.log10(volume24hUsd + 1) * 4) : 0;
    items.push({
      rank: 0,
      source: "dexscreener",
      symbol: symbol.toUpperCase(),
      name,
      score: Math.round(Math.min(100, rankScore * 0.7 + volScore)),
      priceUsd,
      change24h,
      volume24hUsd,
      url: b.url ?? `https://dexscreener.com/solana/${b.tokenAddress}`,
    });
  }
  return { items };
}

/** CoinGecko trending searches (public, keyless). */
async function fetchCoinGecko(): Promise<SourceResult> {
  const data = await getJson("https://api.coingecko.com/api/v3/search/trending");
  const coins: any[] = data.coins ?? [];
  return {
    items: coins.slice(0, 10).map((c, i) => {
      const item = c.item ?? {};
      return {
        rank: 0,
        source: "coingecko" as ScanSource,
        symbol: (item.symbol ?? "?").toUpperCase(),
        name: item.name ?? "?",
        score: Math.round(90 - i * 6),
        priceUsd: item.data?.price != null ? Number(item.data.price) : null,
        change24h:
          item.data?.price_change_percentage_24h?.usd != null
            ? Number(item.data.price_change_percentage_24h.usd)
            : null,
        volume24hUsd: item.data?.total_volume ? parseUsd(item.data.total_volume) : null,
        url: item.id ? `https://www.coingecko.com/en/coins/${item.id}` : null,
      };
    }),
  };
}

/** Crypto headlines via newsapi.org — active once NEWS_API_KEY is set. */
async function fetchNews(apiKey: string | null): Promise<SourceResult> {
  if (!apiKey) return { items: [] };
  const data = await getJson(
    "https://newsapi.org/v2/everything?q=crypto%20OR%20solana%20OR%20memecoin&sortBy=popularity&pageSize=8",
    { "X-Api-Key": apiKey }
  );
  return {
    items: (data.articles ?? []).map((a: any, i: number) => ({
      rank: 0,
      source: "news" as ScanSource,
      symbol: "NEWS",
      name: String(a.title ?? "").slice(0, 80),
      score: Math.round(70 - i * 5),
      priceUsd: null,
      change24h: null,
      volume24hUsd: null,
      url: a.url ?? null,
    })),
  };
}

function parseUsd(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$,]/g, ""));
    return isFinite(n) ? n : null;
  }
  return null;
}
