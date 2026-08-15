"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  COLLECTION_ADDRESS,
  EXPLORER_BASE,
  PUMPBROKER_MINT,
  formatTokens,
} from "../../../../config";
import type { BrokerRow } from "../api/brokers/route";
import { useStats } from "../../lib/useStats";
import { ata, useTx } from "../../lib/useMint";
import { redeemIx } from "../../lib/ix";
import { BrokerCard } from "../../components/BrokerCard";
import { TxStatus } from "../../components/TxStatus";
import { Stat } from "../../components/Stat";

export default function MyBrokers() {
  const { publicKey } = useWallet();
  const { stats, refresh: refreshStats } = useStats();
  const { state, send, reset } = useTx("buyback");
  const [rows, setRows] = useState<BrokerRow[] | null>(null);

  const load = useCallback(async () => {
    if (!publicKey) return setRows(null);
    const r = await fetch(`/api/brokers?owner=${publicKey.toBase58()}`, {
      cache: "no-store",
    });
    const j = (await r.json()) as { brokers: BrokerRow[] };
    setRows(j.brokers);
  }, [publicKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const payout = BigInt(stats?.payout ?? "0");
  const available = stats?.redemptionsAvailable ?? 0;

  const sellBack = useCallback(
    async (mintNumber: number) => {
      const tokenMint = PUMPBROKER_MINT;
      const collectionAddress = COLLECTION_ADDRESS;
      if (!publicKey || !tokenMint || !collectionAddress) return;
      const paymentMint = new PublicKey(tokenMint);
      const collection = new PublicKey(collectionAddress);
      const result = await send(() =>
        redeemIx({
          holder: publicKey,
          holderTokenAccount: ata(publicKey, paymentMint),
          paymentMint,
          collection,
          mintNumber,
        }),
      );
      if (result.ok) {
        await Promise.all([load(), refreshStats()]);
      }
    },
    [publicKey, send, load, refreshStats],
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-widest">MY BROKERS</h1>
        <p className="mt-2 text-sm text-mute">
          Everything this wallet holds, read straight from chain.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="You hold" value={rows?.length ?? "—"} />
        <Stat
          label="Sell-back price"
          value={stats?.buybackLive ? formatTokens(payout) : "—"}
          sub={stats?.buybackLive ? "$PUMPBROKER each" : "not live yet"}
          accent={stats?.buybackLive ? "neon" : "mute"}
        />
        <Stat
          label="Treasury can cover"
          value={stats?.buybackLive ? available : "—"}
          sub="buybacks right now"
          accent={available > 0 ? "neon" : "down"}
        />
      </div>

      <TxStatus state={state} onReset={reset} explorerBase={EXPLORER_BASE} />

      {!publicKey ? (
        <p className="panel text-sm text-mute">Connect a wallet to see your brokers.</p>
      ) : rows === null ? (
        <p className="panel text-sm text-mute">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="panel text-sm text-mute">
          Nothing here yet. Brokers you mint show up automatically.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {rows.map((b) => (
            <BrokerCard
              key={b.address}
              broker={b}
              footer={
                <button
                  className="btn mt-2 w-full py-2 text-[10px]"
                  disabled={!stats?.buybackLive || available < 1}
                  title={
                    !stats?.buybackLive
                      ? "Sell-back is not live yet"
                      : available < 1
                        ? "The treasury can't cover a buyback right now"
                        : undefined
                  }
                  onClick={() => void sellBack(b.mintNumber)}
                >
                  {stats?.buybackLive
                    ? `SELL BACK · ${formatTokens(payout)}`
                    : "SELL-BACK SOON"}
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
