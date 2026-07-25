import { RugSummary } from "./sources/rugcheck";
import { RiskFlag, RiskReport, TokenSnapshot, Verdict } from "./types";

/**
 * Tickers of majors that scam launches love to impersonate. A fresh pair
 * wearing one of these symbols is almost never the real thing.
 */
const BLUECHIP_SYMBOLS = new Set([
  "BTC", "WBTC", "ETH", "WETH", "SOL", "WSOL", "USDC", "USDT", "BNB", "XRP",
  "DOGE", "SHIB", "PEPE", "WIF", "BONK", "FLOKI", "TRUMP", "POPCAT", "PNUT",
  "MOODENG", "PENGU", "FARTCOIN", "GOAT", "MOG", "BRETT", "TURBO",
]);

const fmtUsd = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(0)}`;

/**
 * Heuristic rug/scam scoring. Every flag adds points; 100 caps the score.
 * These are red-flag heuristics, not proof — a clean score is NOT an
 * endorsement, and a flagged token is not a court verdict.
 */
export function scoreToken(
  token: TokenSnapshot,
  opts: {
    rug?: RugSummary | null;
    /** How many tokens in this scan share the symbol (copycat swarms). */
    symbolCount?: number;
    now?: number;
  } = {}
): RiskReport {
  const flags: RiskFlag[] = [];
  const now = opts.now ?? Date.now();
  const add = (id: string, label: string, detail: string, severity: RiskFlag["severity"], points: number) =>
    flags.push({ id, label, detail, severity, points });

  const liq = token.liquidityUsd;
  const fdv = token.fdvUsd ?? token.marketCapUsd;
  const ch24 = token.priceChange.h24;
  const ageHours =
    token.pairCreatedAt !== null ? (now - token.pairCreatedAt) / 3_600_000 : null;

  // --- Liquidity ---------------------------------------------------------
  if (liq === null || liq < 2_000) {
    add(
      "liq-critical",
      "Liquidity near zero",
      `Pool holds ${liq === null ? "unknown/zero" : fmtUsd(liq)} — exit for anyone but the deployer is impossible.`,
      "danger",
      35
    );
  } else if (liq < 10_000) {
    add(
      "liq-thin",
      "Thin liquidity",
      `Only ${fmtUsd(liq)} in the pool; a single mid-size sell moves the chart double digits.`,
      "warn",
      20
    );
  }

  if (liq !== null && liq > 0 && fdv !== null && fdv > 0) {
    const ratio = fdv / liq;
    if (ratio > 300) {
      add(
        "fdv-liq-extreme",
        "FDV wildly out of line with liquidity",
        `FDV ${fmtUsd(fdv)} vs ${fmtUsd(liq)} liquidity (${ratio.toFixed(0)}x). The market cap is a fiction the pool can't pay out.`,
        "danger",
        25
      );
    } else if (ratio > 75) {
      add(
        "fdv-liq-high",
        "High FDV/liquidity ratio",
        `FDV is ${ratio.toFixed(0)}x pooled liquidity — heavy slippage and easy manipulation.`,
        "warn",
        12
      );
    }
  }

  // --- Age & pump shape ---------------------------------------------------
  if (ageHours !== null && ageHours < 24) {
    if (ch24 !== null && ch24 > 300) {
      add(
        "day-one-vertical",
        "Vertical pump on a day-one token",
        `Pair is ${ageHours.toFixed(1)}h old and already +${ch24.toFixed(0)}% — the classic pre-rug candle.`,
        "danger",
        20
      );
    } else {
      add(
        "brand-new",
        "Brand-new pair",
        `Pair is ${ageHours.toFixed(1)}h old. No history, no holders distribution to judge.`,
        "warn",
        8
      );
    }
  }

  // --- Order-flow shape ---------------------------------------------------
  if (token.txns24h) {
    const { buys, sells } = token.txns24h;
    if (sells > buys * 1.6 && (ch24 ?? 0) < -30) {
      add(
        "distribution",
        "Dump in progress",
        `${sells} sells vs ${buys} buys in 24h with price down ${(ch24 ?? 0).toFixed(0)}% — insiders are exiting on whoever is left.`,
        "danger",
        18
      );
    }
    if (buys > 200 && buys > sells * 4 && (ch24 ?? 0) > 200) {
      add(
        "one-way-flow",
        "One-way order flow",
        `${buys} buys vs only ${sells} sells while up ${(ch24 ?? 0).toFixed(0)}% — pattern of wash-trading or a honeypot where selling fails.`,
        "warn",
        15
      );
    }
  }

  // --- Promotion & identity ----------------------------------------------
  if (token.boostsActive > 0) {
    add(
      "paid-promo",
      "Paid promotion",
      `Token is running ${token.boostsActive} active DexScreener boost(s). Visibility was bought, not earned.`,
      "warn",
      8
    );
  }

  if (token.links.length === 0 && !token.hasProfile) {
    add(
      "no-socials",
      "No website or socials",
      "No links, no profile — nothing a deployer would abandon by rugging.",
      "warn",
      10
    );
  }

  const sym = token.symbol.toUpperCase();
  if (BLUECHIP_SYMBOLS.has(sym)) {
    const fresh = ageHours !== null && ageHours < 24 * 7;
    add(
      "impersonation",
      `Wears a major ticker (${sym})`,
      fresh
        ? `A fresh pair using the ${sym} ticker is impersonating the real coin. Verify the contract address.`
        : `Shares the ${sym} ticker with a major coin — verify the contract address before touching it.`,
      fresh ? "danger" : "warn",
      fresh ? 25 : 12
    );
  }
  if ((opts.symbolCount ?? 1) >= 3) {
    add(
      "copycat-swarm",
      "Copycat swarm",
      `${opts.symbolCount} tokens in this scan share the ${sym} ticker — the meta is being farmed by cloners.`,
      "warn",
      10
    );
  }

  // --- On-chain audit (RugCheck, Solana) -----------------------------------
  if (opts.rug) {
    let dangerPts = 0;
    let warnPts = 0;
    for (const r of opts.rug.risks) {
      const level = (r.level ?? "").toLowerCase();
      if (level === "danger") {
        dangerPts = Math.min(30, dangerPts + 15);
        add("rugcheck-danger", `On-chain: ${r.name}`, r.description ?? "Flagged as danger by RugCheck.", "danger", 0);
      } else if (level === "warn") {
        warnPts = Math.min(15, warnPts + 5);
        add("rugcheck-warn", `On-chain: ${r.name}`, r.description ?? "Flagged by RugCheck.", "warn", 0);
      }
    }
    // Points applied via the capped accumulators, attached to the last flag set.
    if (dangerPts + warnPts > 0) {
      flags.push({
        id: "rugcheck-score",
        label: "RugCheck findings",
        detail: `Aggregated on-chain risk from RugCheck (${opts.rug.risks.length} finding(s)).`,
        severity: dangerPts > 0 ? "danger" : "warn",
        points: dangerPts + warnPts,
      });
    }
  }

  const score = Math.min(100, flags.reduce((s, f) => s + f.points, 0));
  return { token, flags, score, verdict: verdictFor(score) };
}

export function verdictFor(score: number): Verdict {
  if (score >= 70) return "AVOID";
  if (score >= 45) return "HIGH RISK";
  if (score >= 25) return "SKETCHY";
  if (score >= 10) return "DYOR";
  return "LOOKS CLEANER";
}

/** Score a whole scan set (computes copycat symbol counts internally). */
export function scoreAll(
  tokens: TokenSnapshot[],
  rugByAddress: Map<string, RugSummary | null> = new Map(),
  now = Date.now()
): RiskReport[] {
  const symbolCounts = new Map<string, number>();
  for (const t of tokens) {
    const s = t.symbol.toUpperCase();
    symbolCounts.set(s, (symbolCounts.get(s) ?? 0) + 1);
  }
  return tokens
    .map((t) =>
      scoreToken(t, {
        rug: rugByAddress.get(t.address),
        symbolCount: symbolCounts.get(t.symbol.toUpperCase()) ?? 1,
        now,
      })
    )
    .sort((a, b) => b.score - a.score);
}
