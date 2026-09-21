"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { formatSol } from "../../../../config/crowdy.ts";
import { useCampaigns, useTx } from "../../lib/hooks.ts";
import { refundIx } from "../../lib/ix.ts";
import { CampaignCard } from "../../components/CampaignCard.tsx";
import { TxStatus } from "../../components/TxStatus.tsx";
import { GateBadge } from "../../components/GateBadge.tsx";

export default function MinePage() {
  const { publicKey } = useWallet();
  const { campaigns, refresh } = useCampaigns();
  const { state, send, reset } = useTx();

  const me = publicKey?.toBase58();

  const { created, backed, refundable, atStake } = useMemo(() => {
    const list = campaigns ?? [];
    const created = list.filter((c) => c.creator === me);
    const backed = list.filter(
      (c) => c.yourContribution && BigInt(c.yourContribution.amount) > 0n,
    );
    const refundable = backed.filter(
      (c) => c.status === "Failed" && !c.yourContribution!.refunded,
    );
    const atStake = backed.reduce((a, c) => a + BigInt(c.yourContribution!.amount), 0n);
    return { created, backed, refundable, atStake };
  }, [campaigns, me]);

  if (!publicKey) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Mine</h1>
        <div className="card p-8 text-center text-sm text-muted">
          Connect a wallet to see what you&apos;ve posted and backed.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Mine</h1>
        <GateBadge compact />
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Posted" value={created.length} />
        <Stat label="Backed" value={backed.length} />
        <Stat label="At stake" value={`${formatSol(atStake)} SOL`} />
      </div>

      <TxStatus state={state} onReset={reset} />

      {/* Refunds first — this is money the person can take back right now, and it
          should never be buried below a list of campaigns. */}
      {refundable.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-success">
            You have {refundable.length} refund{refundable.length === 1 ? "" : "s"} waiting
          </h2>
          {refundable.map((c) => (
            <div
              key={c.address}
              className="card flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <Link href={`/c/${c.id}`} className="text-sm font-medium hover:text-accent">
                  {c.title}
                </Link>
                <p className="mt-0.5 text-xs text-muted">
                  Missed its goal — your{" "}
                  <span className="tnum text-text">
                    {formatSol(BigInt(c.yourContribution!.amount))} SOL
                  </span>{" "}
                  is waiting. No fee.
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const r = await send(() => refundIx(publicKey, c.id));
                  if (r.ok) await refresh();
                }}
              >
                Take it back
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <Section title="Campaigns you posted" items={created} empty="You haven't posted one yet." />
      <Section title="Campaigns you backed" items={backed} empty="You haven't backed one yet." />
    </div>
  );
}

function Section({
  title,
  items,
  empty,
}: {
  title: string;
  items: Parameters<typeof CampaignCard>[0]["c"][];
  empty: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted">{title}</h2>
      {items.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">
          {empty}{" "}
          <Link href="/create" className="text-accent underline underline-offset-2">
            Start one
          </Link>
          .
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((c) => (
            <CampaignCard key={c.address} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="tnum mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
