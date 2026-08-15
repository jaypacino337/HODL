"use client";

import type { ScanItem } from "@/lib/api";
import { formatPct, formatUsd } from "@/lib/format";

export function TickerTape({ items }: { items: ScanItem[] }) {
  const rows = items.filter((i) => i.source !== "news").slice(0, 20);
  const content =
    rows.length > 0 ? (
      rows.map((i) => (
        <span key={`${i.source}-${i.symbol}-${i.rank}`} className="mx-5 text-[12px]">
          <span className="font-bold text-amber-hi">{i.symbol}</span>{" "}
          <span className="num text-paper">{i.priceUsd !== null ? formatUsd(i.priceUsd) : ""}</span>{" "}
          <span className={`num ${i.change24h !== null && i.change24h < 0 ? "neg" : "pos"}`}>
            {formatPct(i.change24h)}
          </span>{" "}
          <span className="text-dim">ATTN {i.score}</span>
        </span>
      ))
    ) : (
      <span className="mx-5 text-[12px] text-dim">
        AWAITING FIRST ATTENTION SCAN — THE TAPE FILLS AS SOON AS THE ENGINE REPORTS…
      </span>
    );

  return (
    <div className="tape py-1.5">
      <div className="tape-inner">
        {content}
        {content}
      </div>
    </div>
  );
}
