"use client";

import Link from "next/link";
import { formatSol, pctOfGoal, timeLeft } from "../../../config/crowdy.ts";
import type { CampaignRow } from "../app/api/campaigns/route.ts";

export function StatusChip({ status, deadline }: { status: string; deadline: number }) {
  const ended = Date.now() / 1000 >= deadline;
  const map: Record<string, string> = {
    Active: ended
      ? "border-warn/40 text-warn"
      : "border-accent/40 text-accent",
    Funded: "border-success/40 text-success",
    Claimed: "border-success/40 text-success",
    Failed: "border-danger/40 text-danger",
  };
  const label =
    status === "Active" && ended ? "Awaiting settlement" : status === "Claimed" ? "Funded & paid out" : status;
  return (
    <span className={`chip ${map[status] ?? "border-edge text-muted"}`}>
      {status === "Active" && !ended ? (
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" />
      ) : null}
      {label}
    </span>
  );
}

export function Progress({
  raised,
  goal,
  status,
}: {
  raised: bigint;
  goal: bigint;
  status: string;
}) {
  const pct = pctOfGoal(raised, goal);
  const colour =
    status === "Failed" ? "bg-danger" : pct >= 100 ? "bg-success" : "bg-accent";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-raised">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${colour}`}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export function CampaignCard({ c }: { c: CampaignRow }) {
  const raised = BigInt(c.raised);
  const goal = BigInt(c.goal);
  const pct = pctOfGoal(raised, goal);

  return (
    <Link
      href={`/c/${c.id}`}
      className="card group flex animate-rise flex-col p-5 transition-colors hover:border-accent/50"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug group-hover:text-accent">{c.title}</h3>
        <StatusChip status={c.status} deadline={c.deadline} />
      </div>

      {c.summary ? (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{c.summary}</p>
      ) : null}

      <div className="mt-4">
        <Progress raised={raised} goal={goal} status={c.status} />
        <div className="mt-2 flex items-baseline justify-between text-sm">
          <span className="tnum">
            <span className="font-medium">{formatSol(raised)}</span>
            <span className="text-muted"> / {formatSol(goal)} SOL</span>
          </span>
          <span className={`tnum text-xs ${pct >= 100 ? "text-success" : "text-muted"}`}>
            {pct}%
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>
          {c.backerCount} {c.backerCount === 1 ? "backer" : "backers"}
        </span>
        <span>{c.status === "Active" ? timeLeft(c.deadline) : "closed"}</span>
      </div>
    </Link>
  );
}
