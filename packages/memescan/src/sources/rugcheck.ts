/**
 * RugCheck (rugcheck.xyz) free report summaries — Solana mints only.
 * Best-effort: any failure just means "no on-chain audit data".
 */

export interface RugRisk {
  name: string;
  description?: string;
  level?: string; // "warn" | "danger" | ...
}

export interface RugSummary {
  scoreNormalised: number | null;
  risks: RugRisk[];
}

export async function fetchRugSummary(
  mint: string,
  timeoutMs = 8_000
): Promise<RugSummary | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(mint)}/report/summary`,
      { signal: ctl.signal, headers: { accept: "application/json" } }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      score_normalised?: number;
      score?: number;
      risks?: { name?: string; description?: string; level?: string }[];
    };
    return {
      scoreNormalised:
        typeof body.score_normalised === "number" ? body.score_normalised : null,
      risks: (body.risks ?? [])
        .filter((r) => r?.name)
        .map((r) => ({ name: r.name!, description: r.description, level: r.level })),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
