"use client";

import { useEffect, useState } from "react";
import {
  fetchFeed,
  fetchLeaderboard,
  fetchOverview,
  fetchScan,
  FeedEvent,
  Overview,
  Rank,
  Scan,
} from "@/lib/api";
import { MINT_ADDRESS, PUMP_FUN_URL } from "@/lib/config";
import { formatSol, hhmmss, shortAddress } from "@/lib/format";
import { TopBar } from "./TopBar";
import { TickerTape } from "./TickerTape";
import { ScannerPanel } from "./ScannerPanel";
import { FlywheelPanel } from "./FlywheelPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";
import { YourTerminal } from "./YourTerminal";
import { AdsPanel } from "./AdsPanel";
import { WirePanel } from "./WirePanel";

export function Terminal() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [o, s, l, f] = await Promise.all([fetchOverview(), fetchScan(), fetchLeaderboard(), fetchFeed()]);
        setOverview(o);
        setScan(s);
        setRanks(l.leaderboard);
        setEvents(f.events);
        setOffline(false);
      } catch {
        setOffline(true);
      }
    };
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  const ticker = overview?.ticker ?? "$ATTN";

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <TopBar ticker={ticker} />
      <TickerTape items={scan?.items ?? []} />

      {offline && (
        <div className="border-b border-neg/40 bg-neg/10 px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-neg">
          Engine link down — reconnecting… panels show last known state
        </div>
      )}

      <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-4">
        {/* command line strapline */}
        <div className="mb-4 border border-term-border bg-term-panel px-3 py-2 text-[12px]">
          <span className="text-dim">attn@terminal:~$</span>{" "}
          <span className="text-paper">
            scan --daily --sources dex,cg,news,tiktok · pay --attention · buyback --auto
          </span>
          <span className="cursor-block" />
          <div className="mt-1 text-[11px] text-dim">
            The scanner sweeps the markets every hour. Fees claimed every 15 minutes power the ecosystem:{" "}
            <span className="pos">50% buybacks</span> / <span className="text-cyan">50% attention rewards</span>.
            Revenue: <span className="pos">90% buybacks</span> / <span className="text-amber">10% development</span>.
            Post about {ticker}, earn attention points, climb toward the airdrop.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <ScannerPanel scan={scan} />
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <FlywheelPanel overview={overview} />
              <LeaderboardPanel ranks={ranks} />
            </div>
          </div>
          <div className="space-y-4">
            <YourTerminal ticker={ticker} />
            <AdsPanel />
            <WirePanel events={events} />
          </div>
        </div>
      </main>

      {/* status bar */}
      <footer className="sticky bottom-0 border-t border-term-border bg-term-panel2 px-4 py-1.5">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.12em] text-dim">
          <span>
            <span className={offline ? "neg" : "pos"}>●</span> ENGINE {offline ? "OFFLINE" : "LINKED"}
          </span>
          <span className="num">
            LAST CLAIM {overview?.lastClaimAt ? hhmmss(overview.lastClaimAt) : "—"} · LAST SWEEP{" "}
            {overview?.lastScanAt ? hhmmss(overview.lastScanAt) : "—"}
          </span>
          <span className="num hidden md:inline">
            POOLS: BUYBACK {overview ? formatSol(overview.pools.buybackPoolLamports) : "—"} SOL · REWARDS{" "}
            {overview ? formatSol(overview.pools.rewardsPoolLamports) : "—"} SOL
          </span>
          {MINT_ADDRESS && (
            <a href={PUMP_FUN_URL} target="_blank" rel="noreferrer" className="num hover:text-amber">
              {ticker} {shortAddress(MINT_ADDRESS, 4)}
            </a>
          )}
          <span className="hidden lg:inline">ATTENTION IS CURRENCY. ATTENTION IS POWER.</span>
        </div>
      </footer>
    </div>
  );
}
