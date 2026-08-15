"use client";

import type { Overview } from "@/lib/api";
import { formatDuration, formatSol } from "@/lib/format";

function Stat({ label, value, accent }: { label: string; value: string; accent?: "pos" | "amber" | "cyan" }) {
  return (
    <div className="border border-term-border bg-term-bg px-3 py-2">
      <div className="label">{label}</div>
      <div
        className={`num mt-0.5 text-[17px] font-bold ${
          accent === "pos" ? "pos" : accent === "cyan" ? "text-cyan" : "text-amber-hi"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function FlywheelPanel({ overview }: { overview: Overview | null }) {
  const t = overview?.totals;
  return (
    <section className="panel">
      <div className="panel-head">
        <div className="panel-title">
          <span className="fkey">F2</span>The Flywheel
        </div>
        <div className="label">FEES POWER THE ECOSYSTEM</div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3 xl:grid-cols-3">
        <Stat label="Fees claimed" value={t ? `${formatSol(t.feesClaimedLamports)} SOL` : "—"} />
        <Stat label="Buybacks executed" value={t ? `${formatSol(t.buybackSpentLamports)} SOL` : "—"} accent="pos" />
        <Stat label="Attention rewards paid" value={t ? `${formatSol(t.rewardsPaidLamports)} SOL` : "—"} accent="pos" />
        <Stat label="Buyback pool (armed)" value={overview ? `${formatSol(overview.pools.buybackPoolLamports)} SOL` : "—"} accent="cyan" />
        <Stat label="Epoch rewards pool" value={overview ? `${formatSol(overview.pools.rewardsPoolLamports)} SOL` : "—"} accent="cyan" />
        <Stat label="Ad revenue" value={t ? `${formatSol(t.adRevenueLamports)} SOL` : "—"} />
      </div>

      <div className="space-y-2 border-t border-term-border p-3 text-[11px]">
        <div>
          <div className="mb-1 flex justify-between">
            <span className="label">Creator fees · every 15 min</span>
            <span className="num text-dim">50 / 50</span>
          </div>
          <div className="flex h-[10px] overflow-hidden border border-term-border">
            <div className="bg-pos" style={{ width: "50%" }} title="buybacks" />
            <div className="bg-cyan" style={{ width: "50%" }} title="attention rewards" />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] uppercase tracking-[0.1em]">
            <span className="pos">Buybacks</span>
            <span className="text-cyan">Attention rewards</span>
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between">
            <span className="label">Project revenue · ads</span>
            <span className="num text-dim">90 / 10</span>
          </div>
          <div className="flex h-[10px] overflow-hidden border border-term-border">
            <div className="bg-pos" style={{ width: "90%" }} title="buybacks" />
            <div className="bg-amber" style={{ width: "10%" }} title="development" />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] uppercase tracking-[0.1em]">
            <span className="pos">Buybacks</span>
            <span className="text-amber">Development</span>
          </div>
        </div>
        {overview?.epoch && (
          <div className="border-t border-term-border pt-2 text-[11px] text-dim">
            EPOCH #{overview.epoch.id} · PAYS OUT IN{" "}
            <span className="num text-amber-hi">{formatDuration(overview.epoch.msRemaining)}</span> · pro-rata
            by attention points
          </div>
        )}
      </div>
    </section>
  );
}
