"use client";

import { useEffect, useMemo, useState } from "react";
import type { StatsResponse } from "@/lib/api";
import { formatCompact, formatSol, lamportsToSol } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_BOT_API_URL ?? "http://localhost:4000";

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!target) return "—";
  const diffMs = new Date(target).getTime() - now;
  if (diffMs <= 0) return "any moment now";
  const totalSeconds = Math.floor(diffMs / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function LiveStats({ initial, initiallyLive }: { initial: StatsResponse; initiallyLive: boolean }) {
  const [stats, setStats] = useState(initial);
  const [live, setLive] = useState(initiallyLive);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stats`);
        if (!res.ok) throw new Error();
        setStats(await res.json());
        setLive(true);
      } catch {
        setLive(false);
      }
    };
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  const countdown = useCountdown(stats.nextSnapshotAt);

  const cards = useMemo(
    () => [
      {
        label: "Holders tracked",
        value: formatCompact(stats.holderCount),
        hint: "at last 15-min snapshot",
      },
      {
        label: "Next snapshot in",
        value: countdown,
        hint: "minutes : seconds",
      },
      {
        label: "Total airdropped",
        value: `${formatSol(stats.totalDistributedLamports, 2)} SOL`,
        hint: "sent directly to holder wallets",
      },
      {
        label: "Total fees harvested",
        value: `${formatSol(stats.totalHarvestedLamports, 2)} SOL`,
        hint: "claimed from pump.fun + transfer fees",
      },
    ],
    [stats, countdown]
  );

  return (
    <section id="stats" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="section-heading text-2xl font-bold sm:text-3xl">Live protocol stats</h2>
          <p className="mt-2 text-white/50">Pulled straight from the on-chain snapshot bot.</p>
        </div>
        <span
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            live ? "bg-sherwood-400/15 text-sherwood-300" : "bg-white/5 text-white/40"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-sherwood-400 pulse-dot" : "bg-white/30"}`} />
          {live ? "Live" : "Bot offline — showing placeholder data"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-card rounded-2xl p-6">
            <p className="text-sm text-white/50">{c.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold text-white">{c.value}</p>
            <p className="mt-1 text-xs text-white/35">{c.hint}</p>
          </div>
        ))}
      </div>
      {stats.lastSnapshot && lamportsToSol(stats.lastSnapshot.rewardsPoolLamports) > 0 && (
        <p className="mt-4 text-sm text-white/40">
          Rewards vault currently holds {formatSol(stats.lastSnapshot.rewardsPoolLamports)} SOL, queued for the next
          pro-rata airdrop.
        </p>
      )}
    </section>
  );
}
