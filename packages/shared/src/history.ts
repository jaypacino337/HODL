/**
 * Deterministic pseudo price history for each outcome, used for sparklines in
 * demo mode. Seeded per market+outcome so server and client render the same
 * series (no hydration mismatch). Live mode replaces this with real trade
 * history from the oracle worker.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * A 30-point probability series ending exactly at `endProb`, wandering with
 * mean reversion so it looks like a traded market, not white noise.
 */
export function probabilityHistory(marketSlug: string, outcomeId: string, endProb: number): number[] {
  const rand = mulberry32(hashString(`${marketSlug}:${outcomeId}`));
  const n = 30;
  const drift = (rand() - 0.5) * 0.25; // where it drifted from
  let p = Math.min(0.92, Math.max(0.04, endProb - drift));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const toward = p + (endProb - p) * (i / (n - 1)) - p; // pull toward endProb
    p += toward * 0.35 + (rand() - 0.5) * 0.035;
    p = Math.min(0.95, Math.max(0.03, p));
    out.push(p);
  }
  out[n - 1] = endProb;
  return out;
}
