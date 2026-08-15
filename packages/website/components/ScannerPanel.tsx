"use client";

import type { Scan } from "@/lib/api";
import { formatPct, formatUsd, hhmmss } from "@/lib/format";

const SOURCE_BADGE: Record<string, string> = {
  dexscreener: "DEX",
  coingecko: "CG",
  news: "WIRE",
  tiktok: "TT",
};

export function ScannerPanel({ scan }: { scan: Scan | null }) {
  const tokens = (scan?.items ?? []).filter((i) => i.source !== "news");
  const headlines = (scan?.items ?? []).filter((i) => i.source === "news");

  return (
    <section className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="fkey">F1</span>Attention Scanner
        </div>
        <div className="label num">
          {scan?.ranAt ? `LAST SWEEP ${hhmmss(scan.ranAt)}` : "AWAITING SWEEP"}
        </div>
      </div>

      <div className="max-h-[420px] overflow-x-auto overflow-y-auto">
        <table className="tbl">
          <thead className="sticky top-0 bg-term-panel2">
            <tr>
              <th>#</th>
              <th>SRC</th>
              <th>ASSET</th>
              <th className="text-right">ATTN</th>
              <th className="text-right">PRICE</th>
              <th className="text-right">24H</th>
              <th className="text-right">VOL 24H</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((i) => (
              <tr key={`${i.source}-${i.rank}`}>
                <td className="num text-dim">{String(i.rank).padStart(2, "0")}</td>
                <td>
                  <span className="badge border-term-bright text-cyan">{SOURCE_BADGE[i.source]}</span>
                </td>
                <td>
                  <a
                    href={i.url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-amber-hi hover:underline"
                  >
                    {i.symbol}
                  </a>{" "}
                  <span className="hidden text-dim lg:inline">{i.name.slice(0, 24)}</span>
                </td>
                <td className="text-right">
                  <span className="num font-bold text-amber">{i.score}</span>
                  <span
                    className="ml-2 inline-block h-[7px] bg-amber align-middle"
                    style={{ width: `${Math.max(4, i.score * 0.5)}px`, opacity: 0.35 + i.score / 200 }}
                  />
                </td>
                <td className="num text-right">{formatUsd(i.priceUsd)}</td>
                <td className={`num text-right ${i.change24h !== null && i.change24h < 0 ? "neg" : "pos"}`}>
                  {formatPct(i.change24h)}
                </td>
                <td className="num text-right text-paper/80">{formatUsd(i.volume24hUsd)}</td>
              </tr>
            ))}
            {tokens.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-dim">
                  SCANNER SPINNING UP — first sweep lands within the hour of engine boot.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {headlines.length > 0 && (
        <div className="border-t border-term-border px-3 py-2">
          <div className="label mb-1">Wire headlines</div>
          {headlines.slice(0, 4).map((h, idx) => (
            <div key={idx} className="truncate py-0.5 text-[12px]">
              <span className="text-cyan">»</span>{" "}
              <a href={h.url ?? "#"} target="_blank" rel="noreferrer" className="hover:text-amber-hi">
                {h.name}
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-term-border px-3 py-2">
        {(scan?.sources ?? []).map((s) => (
          <span key={s.source} className="text-[10px] uppercase tracking-[0.12em]">
            <span
              className={
                s.status === "live" ? "pos" : s.status === "needs_key" ? "text-amber" : "neg"
              }
            >
              ●
            </span>{" "}
            <span className="text-paper/80">{s.source}</span>{" "}
            <span className="text-dim">{s.status === "live" ? s.detail : s.status.replace("_", " ")}</span>
          </span>
        ))}
        {!scan && <span className="label">source status appears after the first sweep</span>}
      </div>
    </section>
  );
}
