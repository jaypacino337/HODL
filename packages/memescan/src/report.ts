import { NarrativeCluster, RiskReport, ScanResult, Verdict } from "./types";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s: string) => c("1", s);
const dim = (s: string) => c("2", s);
const red = (s: string) => c("31", s);
const yellow = (s: string) => c("33", s);
const green = (s: string) => c("32", s);
const cyan = (s: string) => c("36", s);
const magenta = (s: string) => c("35", s);

export const fmtUsd = (n: number | null): string => {
  if (n === null) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

export const fmtPct = (n: number | null): string =>
  n === null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(0)}%`;

export const fmtAge = (createdAt: number | null, now: number): string => {
  if (createdAt === null) return "—";
  const h = (now - createdAt) / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(0)}h`;
  return `${(h / 24).toFixed(0)}d`;
};

const verdictColor: Record<Verdict, (s: string) => string> = {
  AVOID: red,
  "HIGH RISK": red,
  SKETCHY: yellow,
  DYOR: yellow,
  "LOOKS CLEANER": green,
};

function pad(s: string, w: number): string {
  // eslint-disable-next-line no-control-regex
  const visible = s.replace(/\x1b\[\d+m/g, "");
  return s + " ".repeat(Math.max(0, w - visible.length));
}

export function renderTerminal(result: ScanResult): string {
  const now = result.generatedAt;
  const lines: string[] = [];
  const hr = dim("─".repeat(78));

  lines.push("");
  lines.push(bold(magenta("  ▄▖MEMESCAN")) + dim("  narrative radar + rug-risk scanner"));
  lines.push(
    dim(
      `  source: ${result.source}${result.query ? ` (query: "${result.query}")` : ""}` +
        ` · ${result.tokens.length} tokens · ${new Date(now).toISOString()}`
    )
  );
  for (const note of result.notes) lines.push(yellow(`  ⚠ ${note}`));
  lines.push(hr);

  // --- Narrative leaderboard ---------------------------------------------
  lines.push(bold("  🔥 NARRATIVE LEADERBOARD ") + dim("(what the degens are rotating into)"));
  lines.push(
    dim(
      "  " +
        pad("#", 4) + pad("narrative", 38) + pad("tokens", 8) + pad("new 24h", 9) +
        pad("vol 24h", 10) + pad("med Δ24h", 10) + "avg risk"
    )
  );
  result.narratives.slice(0, 12).forEach((n, i) => {
    const riskStr =
      n.stats.avgRiskScore >= 45 ? red(`${n.stats.avgRiskScore}`) :
      n.stats.avgRiskScore >= 25 ? yellow(`${n.stats.avgRiskScore}`) :
      green(`${n.stats.avgRiskScore}`);
    const shortLabel = n.label.length > 35 ? n.label.slice(0, 34) + "…" : n.label;
    const label = n.kind === "emergent" ? cyan(shortLabel) : shortLabel;
    lines.push(
      "  " +
        pad(`${i + 1}`, 4) + pad(label, 38) + pad(`${n.stats.tokenCount}`, 8) +
        pad(`${n.stats.newTokens24h}`, 9) + pad(fmtUsd(n.stats.totalVolume24hUsd), 10) +
        pad(fmtPct(n.stats.medianChange24h), 10) + riskStr
    );
  });
  lines.push(hr);

  // --- Scam wall ----------------------------------------------------------
  const risky = result.reports.filter((r) => r.score >= 25);
  lines.push(bold("  ☠ SCAM WALL ") + dim(`(${risky.length} flagged of ${result.reports.length} scanned)`));
  for (const r of risky.slice(0, 15)) {
    const t = r.token;
    lines.push(
      "  " +
        pad(verdictColor[r.verdict](`[${r.verdict}]`), 16) +
        pad(bold(`${t.symbol}`), 12) + pad(dim(t.name.slice(0, 24)), 26) +
        pad(`risk ${r.score}/100`, 13) +
        dim(`liq ${fmtUsd(t.liquidityUsd)} · Δ24h ${fmtPct(t.priceChange.h24)} · age ${fmtAge(t.pairCreatedAt, now)}`)
    );
    for (const f of r.flags.filter((f) => f.severity !== "info").slice(0, 4)) {
      const mark = f.severity === "danger" ? red("✗") : yellow("!");
      lines.push(`      ${mark} ${f.label}${dim(" — " + f.detail)}`);
    }
  }
  lines.push(hr);

  // --- Cleaner end of the pool ---------------------------------------------
  const cleaner = [...result.reports].sort((a, b) => a.score - b.score).slice(0, 5);
  lines.push(bold("  🧼 CLEANEST OF THE TRENDING SET ") + dim("(least red flags ≠ safe)"));
  for (const r of cleaner) {
    const t = r.token;
    lines.push(
      "  " +
        pad(green(`risk ${r.score}`), 12) + pad(bold(t.symbol), 12) +
        pad(dim(t.name.slice(0, 24)), 26) +
        dim(`liq ${fmtUsd(t.liquidityUsd)} · vol ${fmtUsd(t.volume24hUsd)} · age ${fmtAge(t.pairCreatedAt, now)}`)
    );
  }
  lines.push(hr);
  lines.push(
    dim(
      "  Heuristics only — not financial advice, not proof of fraud, and a low score\n" +
        "  is not an endorsement. Memecoins can (and mostly do) go to zero."
    )
  );
  lines.push("");
  return lines.join("\n");
}

export function renderMarkdown(result: ScanResult): string {
  const now = result.generatedAt;
  const L: string[] = [];
  L.push(`# MEMESCAN report`);
  L.push("");
  L.push(
    `> Source: **${result.source}**${result.query ? ` (query: \`${result.query}\`)` : ""} · ` +
      `${result.tokens.length} tokens · ${new Date(now).toISOString()}`
  );
  for (const note of result.notes) L.push(`>\n> ⚠ ${note}`);
  L.push("");
  L.push(`## 🔥 Narrative leaderboard`);
  L.push("");
  L.push(`| # | Narrative | Kind | Tokens | New 24h | Vol 24h | Median Δ24h | Avg risk |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  result.narratives.slice(0, 12).forEach((n, i) => {
    L.push(
      `| ${i + 1} | ${n.label} | ${n.kind} | ${n.stats.tokenCount} | ${n.stats.newTokens24h} | ` +
        `${fmtUsd(n.stats.totalVolume24hUsd)} | ${fmtPct(n.stats.medianChange24h)} | ${n.stats.avgRiskScore}/100 |`
    );
  });
  L.push("");
  L.push(`## ☠ Scam wall`);
  L.push("");
  for (const r of result.reports.filter((r) => r.score >= 25)) {
    const t = r.token;
    L.push(`### ${t.symbol} — ${t.name} · **${r.verdict}** (risk ${r.score}/100)`);
    L.push("");
    L.push(
      `\`${t.chainId}:${t.address}\` · liq ${fmtUsd(t.liquidityUsd)} · FDV ${fmtUsd(t.fdvUsd)} · ` +
        `Δ24h ${fmtPct(t.priceChange.h24)} · age ${fmtAge(t.pairCreatedAt, now)}` +
        (t.url ? ` · [chart](${t.url})` : "")
    );
    L.push("");
    for (const f of r.flags) {
      L.push(`- ${f.severity === "danger" ? "🔴" : f.severity === "warn" ? "🟡" : "ℹ️"} **${f.label}** — ${f.detail}`);
    }
    L.push("");
  }
  L.push(`## 🧼 Cleanest of the trending set`);
  L.push("");
  L.push(`| Risk | Symbol | Name | Liquidity | Vol 24h | Age |`);
  L.push(`|---|---|---|---|---|---|`);
  for (const r of [...result.reports].sort((a, b) => a.score - b.score).slice(0, 8)) {
    const t = r.token;
    L.push(
      `| ${r.score}/100 | ${t.symbol} | ${t.name} | ${fmtUsd(t.liquidityUsd)} | ${fmtUsd(t.volume24hUsd)} | ${fmtAge(t.pairCreatedAt, now)} |`
    );
  }
  L.push("");
  L.push(
    `---\n*Heuristics only — not financial advice, not proof of fraud; a low score is not an endorsement.*`
  );
  L.push("");
  return L.join("\n");
}
