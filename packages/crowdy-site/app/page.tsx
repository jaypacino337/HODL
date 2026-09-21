"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FEE_BPS, SITE, formatGate, formatSol } from "../../../config/crowdy.ts";
import { useCampaigns, usePlatform } from "../lib/hooks.ts";
import { CampaignCard } from "../components/CampaignCard.tsx";

type Filter = "live" | "funded" | "failed" | "all";

export default function Home() {
  const { platform } = usePlatform();
  const { campaigns } = useCampaigns();
  const [filter, setFilter] = useState<Filter>("live");

  const now = Date.now() / 1000;

  const stats = useMemo(() => {
    const list = campaigns ?? [];
    const raised = list.reduce((a, c) => a + BigInt(c.raised), 0n);
    const funded = list.filter((c) => c.status === "Funded" || c.status === "Claimed").length;
    const live = list.filter((c) => c.status === "Active" && c.deadline > now).length;
    return { raised, funded, live, total: list.length };
  }, [campaigns, now]);

  const shown = useMemo(() => {
    const list = campaigns ?? [];
    switch (filter) {
      case "live":
        return list.filter((c) => c.status === "Active" && c.deadline > now);
      case "funded":
        return list.filter((c) => c.status === "Funded" || c.status === "Claimed");
      case "failed":
        return list.filter((c) => c.status === "Failed");
      default:
        return list;
    }
  }, [campaigns, filter, now]);

  return (
    <div className="space-y-12">
      {/* ------------------------------------------------------------- hero */}
      <section className="pt-6 text-center">
        <h1 className="mx-auto max-w-2xl text-3xl font-semibold leading-tight sm:text-5xl">
          Somebody says{" "}
          <span className="text-accent">let&apos;s do this</span>.
          <br />
          Holders decide if it happens.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
          Post an idea, set a goal, set a deadline. Hit the goal and the money is
          released. Miss it and every backer takes their SOL back —{" "}
          <span className="text-text">in full</span>, without needing anyone&apos;s
          permission.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/create" className="btn btn-primary px-5 py-3">
            Start a campaign
          </Link>
          <a href="#campaigns" className="btn px-5 py-3">
            Browse what&apos;s live
          </a>
        </div>
      </section>

      {/* ------------------------------------------------------------ stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Raised" value={`${formatSol(stats.raised)} SOL`} />
        <Stat label="Live now" value={stats.live} accent />
        <Stat label="Funded" value={stats.funded} />
        <Stat label="Campaigns" value={stats.total} />
      </section>

      {/* ------------------------------------------------------- how it works */}
      <section>
        <h2 className="mb-4 text-sm font-medium text-muted">How it works</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [
              "Hold to play",
              platform?.gateAmount
                ? `You need ${formatGate(BigInt(platform.gateAmount))} tokens to post a campaign or back one. Sell out and you're no longer eligible — the check reads your balance at the moment you act.`
                : "You need to hold the token to post a campaign or back one.",
            ],
            [
              "All or nothing",
              "A campaign only pays out if it reaches its goal by the deadline. Until then the SOL sits in a vault the program controls — the creator cannot touch a lamport of it.",
            ],
            [
              "Refunds can't be blocked",
              "If a campaign misses, anyone can settle it and every backer withdraws their exact contribution. No fee on refunds, and the creator doesn't have to co-operate.",
            ],
          ].map(([title, body], i) => (
            <div key={title} className="card p-5">
              <div className="mb-2 grid h-7 w-7 place-items-center rounded-lg bg-accent/15 text-xs font-semibold text-accent">
                {i + 1}
              </div>
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Crowdy takes {(FEE_BPS / 100).toFixed(1)}% of a campaign that succeeds, and
          nothing at all from one that doesn&apos;t.
        </p>
      </section>

      {/* -------------------------------------------------------- campaigns */}
      <section id="campaigns" className="scroll-mt-20">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted">Campaigns</h2>
          <div className="flex gap-1">
            {(["live", "funded", "failed", "all"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-2.5 py-1.5 text-xs capitalize transition-colors ${
                  filter === f ? "bg-raised text-text" : "text-muted hover:text-text"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {!platform?.configured ? (
          <Empty>
            Crowdy isn&apos;t configured yet — no gate token has been set, so there&apos;s
            nothing live to show.
          </Empty>
        ) : !platform.deployed ? (
          <Empty>The program isn&apos;t deployed yet. Campaigns will show up here once it is.</Empty>
        ) : campaigns === null ? (
          <Empty>Reading campaigns from chain…</Empty>
        ) : shown.length === 0 ? (
          <Empty>
            {filter === "live"
              ? "Nothing live right now."
              : `No ${filter} campaigns yet.`}{" "}
            <Link href="/create" className="text-accent underline underline-offset-2">
              Start one
            </Link>
            .
          </Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((c) => (
              <CampaignCard key={c.address} c={c} />
            ))}
          </div>
        )}
      </section>

      {platform?.paused ? (
        <div className="rounded-xl border border-warn/40 bg-warn/5 p-4 text-sm">
          <span className="font-medium text-warn">Crowdy is paused.</span>{" "}
          <span className="text-muted">
            No new campaigns or contributions. Settling and refunds still work normally —
            pausing never traps money that&apos;s already in a vault.
          </span>
        </div>
      ) : null}

      <p className="text-center text-xs text-muted">{SITE.description}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`tnum mt-1 text-xl font-semibold ${accent ? "text-accent" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-sm text-muted">{children}</div>;
}
