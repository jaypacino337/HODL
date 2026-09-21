"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import {
  FEE_BPS,
  GATE_AMOUNT,
  GATE_MINT,
  explorerAddr,
  formatSol,
  pctOfGoal,
  sol,
  timeLeft,
} from "../../../../../config/crowdy.ts";
import { useCampaigns, useGateBalance, usePlatform, useTx } from "../../../lib/hooks.ts";
import {
  cancelCampaignIx,
  claimFundsIx,
  contributeIx,
  finalizeIx,
  refundIx,
} from "../../../lib/ix.ts";
import { Progress, StatusChip } from "../../../components/CampaignCard.tsx";
import { TxStatus } from "../../../components/TxStatus.tsx";
import { GateBadge } from "../../../components/GateBadge.tsx";

const PRESETS = [0.1, 0.5, 1, 5];

export default function CampaignPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const { campaigns, refresh } = useCampaigns({ id });
  const { platform } = usePlatform();
  const { balance, gateAccount } = useGateBalance();
  const { state, send, reset, publicKey } = useTx();
  const [amount, setAmount] = useState("");

  const c = campaigns?.[0];
  const eligible = balance !== null && balance >= GATE_AMOUNT;

  const now = Date.now() / 1000;
  const ended = c ? now >= c.deadline : false;
  const isCreator = Boolean(c && publicKey && c.creator === publicKey.toBase58());
  const yours = c?.yourContribution;

  const amountLamports = useMemo(() => {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0 ? sol(n) : 0n;
  }, [amount]);

  const act = useCallback(
    async (build: () => Parameters<typeof send>[0] extends never ? never : ReturnType<typeof finalizeIx>) => {
      const r = await send(build as never);
      if (r.ok) await refresh();
    },
    [send, refresh],
  );

  if (campaigns === null) {
    return <div className="card p-8 text-center text-sm text-muted">Loading…</div>;
  }
  if (!c) {
    return (
      <div className="card p-8 text-center text-sm text-muted">
        No campaign #{params.id}.{" "}
        <Link href="/" className="text-accent underline underline-offset-2">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const raised = BigInt(c.raised);
  const goal = BigInt(c.goal);
  const pct = pctOfGoal(raised, goal);
  const metGoal = raised >= goal;

  // Settling is permissionless on purpose, so the button is shown to everyone —
  // a backer must be able to settle a campaign the creator has walked away from.
  const canFinalize = c.status === "Active" && (ended || metGoal);
  const canContribute = c.status === "Active" && !ended && eligible && !platform?.paused;
  const canClaim = c.status === "Funded" && isCreator;
  const canRefund =
    c.status === "Failed" && yours && !yours.refunded && BigInt(yours.amount) > 0n;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-text">
        ← All campaigns
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{c.title}</h1>
          <StatusChip status={c.status} deadline={c.deadline} />
        </div>
        {c.summary ? (
          <p className="max-w-2xl leading-relaxed text-muted">{c.summary}</p>
        ) : null}
        {c.link ? (
          <a
            href={c.link}
            target="_blank"
            rel="noreferrer nofollow"
            className="inline-block break-all text-sm text-accent underline underline-offset-2"
          >
            {c.link}
          </a>
        ) : null}
      </header>

      {/* ------------------------------------------------------ progress */}
      <section className="card space-y-4 p-6">
        <Progress raised={raised} goal={goal} status={c.status} />

        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="tnum text-2xl font-semibold">
            {formatSol(raised)}{" "}
            <span className="text-base font-normal text-muted">
              of {formatSol(goal)} SOL
            </span>
          </div>
          <div className={`tnum text-sm ${pct >= 100 ? "text-success" : "text-muted"}`}>
            {pct}% funded
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-edge pt-4 text-sm">
          <Cell label="Backers" value={c.backerCount} />
          <Cell label={ended ? "Ended" : "Time left"} value={ended ? "—" : timeLeft(c.deadline)} />
          <Cell
            label="Your stake"
            value={yours && BigInt(yours.amount) > 0n ? `${formatSol(BigInt(yours.amount))} SOL` : "—"}
          />
        </div>
      </section>

      <TxStatus state={state} onReset={reset} />

      {/* ------------------------------------------------------ contribute */}
      {c.status === "Active" && !ended ? (
        <section className="card space-y-4 p-6">
          <h2 className="font-medium">Back this</h2>

          {!publicKey ? (
            <p className="text-sm text-muted">Connect a wallet to back this campaign.</p>
          ) : !eligible ? (
            <GateBadge />
          ) : null}

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p} className="btn py-2 text-xs" onClick={() => setAmount(String(p))}>
                {p} SOL
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              className="input tnum"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            />
            <button
              className="btn btn-primary whitespace-nowrap"
              disabled={!canContribute || amountLamports <= 0n || state.kind === "simulating"}
              onClick={() => {
                if (!publicKey || !gateAccount) return;
                void act(() =>
                  contributeIx({
                    backer: publicKey,
                    backerGateAccount: gateAccount,
                    campaignId: c.id,
                    amountLamports,
                  }),
                );
              }}
            >
              Back it
            </button>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            Your SOL goes to a vault the program controls, not to the creator. If this
            campaign misses its goal you can withdraw every lamport back — refunds take
            no fee. If it succeeds, Crowdy keeps {(FEE_BPS / 100).toFixed(1)}%.
          </p>
        </section>
      ) : null}

      {/* -------------------------------------------------------- actions */}
      {canFinalize || canClaim || canRefund || (isCreator && c.status === "Active") ? (
        <section className="card space-y-3 p-6">
          <h2 className="font-medium">Actions</h2>

          {canFinalize ? (
            <Action
              title={metGoal ? "Settle as funded" : "Settle as failed"}
              body={
                metGoal
                  ? "It hit the goal. Settling releases the funds to the creator."
                  : "It missed the goal. Settling opens refunds for every backer. Anyone can do this — you don't have to wait for the creator."
              }
              label="Settle"
              onClick={() => publicKey && void act(() => finalizeIx(publicKey, c.id))}
            />
          ) : null}

          {canClaim ? (
            <Action
              title="Claim the funds"
              body={`You'll receive ${formatSol(
                (raised * BigInt(10_000 - (platform?.feeBps ?? FEE_BPS))) / 10_000n,
              )} SOL after the ${((platform?.feeBps ?? FEE_BPS) / 100).toFixed(1)}% platform fee.`}
              label="Claim"
              primary
              onClick={() => {
                if (!publicKey || !platform?.feeDestination) return;
                void act(() =>
                  claimFundsIx({
                    creator: publicKey,
                    campaignId: c.id,
                    feeDestination: new PublicKey(platform.feeDestination!),
                  }),
                );
              }}
            />
          ) : null}

          {canRefund ? (
            <Action
              title="Take your SOL back"
              body={`This campaign failed, so you can withdraw your full ${formatSol(
                BigInt(yours!.amount),
              )} SOL. No fee, no haircut.`}
              label="Refund"
              primary
              onClick={() => publicKey && void act(() => refundIx(publicKey, c.id))}
            />
          ) : null}

          {isCreator && c.status === "Active" ? (
            <Action
              title="Cancel your campaign"
              body="Ends it now and opens refunds for everyone immediately, instead of making backers wait out the deadline. This can never send money to you."
              label="Cancel"
              danger
              onClick={() => publicKey && void act(() => cancelCampaignIx(publicKey, c.id))}
            />
          ) : null}
        </section>
      ) : null}

      {c.status === "Failed" && yours?.refunded ? (
        <div className="rounded-xl border border-edge bg-raised p-4 text-sm text-muted">
          You&apos;ve already taken your refund from this campaign.
        </div>
      ) : null}

      <section className="card p-6 text-xs text-muted">
        <div className="label mb-2">On chain</div>
        <dl className="space-y-1">
          <Row label="Campaign" value={c.address} />
          <Row label="Creator" value={c.creator} />
        </dl>
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="tnum mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <dt className="w-20 shrink-0">{label}</dt>
      <dd className="break-all">
        <a
          href={explorerAddr(value)}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-text"
        >
          {value}
        </a>
      </dd>
    </div>
  );
}

function Action({
  title,
  body,
  label,
  onClick,
  primary,
  danger,
}: {
  title: string;
  body: string;
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-bg p-4">
      <div className="min-w-[200px] flex-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{body}</p>
      </div>
      <button
        className={`btn ${primary ? "btn-primary" : ""} ${
          danger ? "border-danger/50 text-danger hover:bg-danger/10" : ""
        }`}
        onClick={onClick}
      >
        {label}
      </button>
    </div>
  );
}
