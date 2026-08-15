"use client";

import { useCallback, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  COLLECTION_ADDRESS,
  EXPLORER_BASE,
  PUMPBROKER_MINT,
  formatTokens,
} from "../../../../config";
import { useStats } from "../../lib/useStats";
import { ata, useTx } from "../../lib/useMint";
import { mintIx, remintIx } from "../../lib/ix";
import { RACED_CODE } from "../../lib/errors";
import { Stat, SupplyMeter } from "../../components/Stat";
import { TxStatus } from "../../components/TxStatus";

const MAX_RACE_RETRIES = 5;

export default function MintPage() {
  const { stats, refresh } = useStats(5000);
  const { state, send, reset, publicKey } = useTx("mint");
  const [note, setNote] = useState<string | null>(null);

  const price = BigInt(stats?.price ?? "0");
  const canMint = Boolean(
    stats?.live && stats.isActive && publicKey && PUMPBROKER_MINT && COLLECTION_ADDRESS,
  );

  /**
   * Two wallets can reach for the same broker number at the same moment. The program
   * rejects the loser with MintRaced instead of a confusing runtime error, and we
   * simply re-read the count and try the next number. Bounded, so a genuinely
   * sold-out mint cannot spin forever.
   */
  const doMint = useCallback(async () => {
    const tokenMint = PUMPBROKER_MINT;
    const collectionAddress = COLLECTION_ADDRESS;
    if (!publicKey || !tokenMint || !collectionAddress) return;
    const paymentMint = new PublicKey(tokenMint);
    const collection = new PublicKey(collectionAddress);
    setNote(null);

    for (let attempt = 0; attempt < MAX_RACE_RETRIES; attempt++) {
      const fresh = await fetch("/api/stats", { cache: "no-store" }).then((r) => r.json());

      // Prefer a broker sitting in the vault: it already exists, so re-minting it
      // costs the buyer no account rent at all.
      const fromVault: number | undefined = fresh.vaultQueue?.[0];
      const useVault = typeof fromVault === "number";
      const expectedNumber = useVault
        ? fromVault
        : Number(fresh.minted) - Number(fresh.honoraryCount);

      const result = await send(
        () =>
          useVault
            ? remintIx({
                minter: publicKey,
                minterTokenAccount: ata(publicKey, paymentMint),
                paymentMint,
                collection,
                mintNumber: expectedNumber,
              })
            : mintIx({
                minter: publicKey,
                minterTokenAccount: ata(publicKey, paymentMint),
                paymentMint,
                collection,
                expectedNumber,
              }),
        { computeUnits: 250_000 },
      );

      if (result.ok) {
        await refresh();
        return;
      }
      if (result.error.code !== RACED_CODE) return;
      setNote(`Someone beat you to that one. Retrying… (${attempt + 1}/${MAX_RACE_RETRIES})`);
    }

    setNote("Too many wallets minting at once. Give it a few seconds and try again.");
  }, [publicKey, send, refresh]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-widest">MINT A BROKER</h1>
        <p className="mt-2 max-w-xl text-sm text-mute">
          One broker, drawn at random from whatever is left. Created inside your own
          transaction — nothing was pre-minted and sitting in a wallet waiting for you.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Price" value={formatTokens(price)} sub="$PUMPBROKER" accent="neon" />
        <Stat
          label="Remaining"
          value={stats ? stats.totalSupply - stats.minted : "—"}
          sub={`of ${stats?.totalSupply ?? 1000}`}
        />
        <Stat
          label="Network rent"
          value="~0.0025"
          sub="SOL, paid to the network"
        />
      </div>

      {stats ? <SupplyMeter minted={stats.minted} total={stats.totalSupply} /> : null}

      <section className="panel-neon space-y-4">
        {!stats?.live ? (
          <Banner>
            The mint program is not deployed yet. Nothing to mint — check back at launch.
          </Banner>
        ) : !stats.isActive ? (
          <Banner>
            The mint is deployed and paused. It opens with a single transaction at
            launch.
          </Banner>
        ) : !publicKey ? (
          <Banner>Connect a wallet to mint.</Banner>
        ) : null}

        <button
          className="btn btn-primary w-full py-4"
          disabled={!canMint || ["building", "simulating", "signing", "confirming"].includes(state.kind)}
          onClick={() => void doMint()}
        >
          {state.kind === "idle" || state.kind === "done" || state.kind === "error"
            ? `MINT FOR ${formatTokens(price)} $PUMPBROKER`
            : "WORKING…"}
        </button>

        {note ? <p className="text-xs text-neon">{note}</p> : null}

        <TxStatus state={state} onReset={reset} explorerBase={EXPLORER_BASE} />

        <p className="text-[11px] leading-relaxed text-mute">
          Your wallet will show two costs in one transaction: the mint price in
          $PUMPBROKER, and roughly 0.0025 SOL of network rent to create your
          broker&apos;s account. The rent goes to Solana, not to us. Every transaction
          is simulated before you are asked to sign, so if something is going to fail
          you find out before you approve it.
        </p>
      </section>
    </div>
  );
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-2 border-edge bg-ink p-3 text-xs text-mute">{children}</div>
  );
}
