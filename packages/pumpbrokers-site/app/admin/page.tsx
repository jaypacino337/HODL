"use client";

import { useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { EXPLORER_BASE, PUMPBROKER_MINT, formatTokens } from "../../../../config";
import { useStats } from "../../lib/useStats";
import { ata, useTx } from "../../lib/useMint";
import { setActiveIx, setRedeemerIx, withdrawTreasuryIx } from "../../lib/ix";
import { buybackConfigPda } from "../../lib/pda";
import { TxStatus } from "../../components/TxStatus";
import { Stat } from "../../components/Stat";

/**
 * Owner-only admin.
 *
 * There is no private key anywhere near this page and no server route that signs.
 * Every action is built here and signed by the owner's connected wallet — which is
 * also why the gate below is honest about what it is: a UI convenience. The real
 * authority check is the `address = config.authority` constraint in the program, and
 * that one cannot be bypassed by editing JavaScript.
 */
export default function Admin() {
  const { publicKey } = useWallet();
  const { stats, refresh } = useStats(5000);
  const { state, send, reset } = useTx("mint");
  const [authority, setAuthority] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => {
    void fetch("/api/stats")
      .then((r) => r.json())
      .then(() => undefined);
    // The authority lives on the config account; /api/stats deliberately does not
    // publish it, so read it here only when an admin is actually looking.
    void fetch("/api/admin-check", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setAuthority(j?.authority ?? null))
      .catch(() => setAuthority(null));
  }, []);

  const isOwner = Boolean(publicKey && authority && publicKey.toBase58() === authority);
  const treasury = BigInt(stats?.treasury ?? "0");

  if (!publicKey) {
    return <Gate>Connect the authority wallet.</Gate>;
  }
  if (authority && !isOwner) {
    return <Gate>This wallet is not the mint authority.</Gate>;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-widest">ADMIN</h1>
        <p className="mt-2 text-sm text-mute">
          Signed by your connected wallet. Nothing here holds a key.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Mint"
          value={stats?.isActive ? "OPEN" : "PAUSED"}
          accent={stats?.isActive ? "neon" : "down"}
        />
        <Stat label="Minted" value={`${stats?.minted ?? 0} / ${stats?.totalSupply ?? 1000}`} />
        <Stat label="Treasury" value={formatTokens(treasury)} sub="$PUMPBROKER" />
      </div>

      <TxStatus state={state} onReset={reset} explorerBase={EXPLORER_BASE} />

      {/* ------------------------------------------------------------ launch */}
      <section className="panel-neon space-y-3">
        <h2 className="text-sm font-bold tracking-widest text-neon">LAUNCH SWITCH</h2>
        <p className="text-xs leading-relaxed text-mute">
          This is the entire launch: one instruction, about five seconds, one signature
          fee. Rollback is the same button in the other direction — it takes the same
          five seconds.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn btn-primary"
            disabled={!stats?.live || stats.isActive}
            onClick={() =>
              void send(() => setActiveIx(publicKey, true)).then(() => refresh())
            }
          >
            OPEN THE MINT
          </button>
          <button
            className="btn btn-danger"
            disabled={!stats?.live || !stats.isActive}
            onClick={() =>
              void send(() => setActiveIx(publicKey, false)).then(() => refresh())
            }
          >
            PAUSE THE MINT
          </button>
        </div>
      </section>

      {/* ----------------------------------------------------------- buyback */}
      <section className="panel space-y-3">
        <h2 className="text-sm font-bold tracking-widest">BUYBACK CONNECTION</h2>
        <p className="text-xs leading-relaxed text-mute">
          Connecting points the mint program at the buyback program&apos;s PDA.
          Disconnecting kills redemption instantly without redeploying or touching
          either program.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="btn"
            disabled={!stats?.live}
            onClick={() =>
              void send(() => setRedeemerIx(publicKey, buybackConfigPda())).then(() =>
                refresh(),
              )
            }
          >
            CONNECT PIECE 3
          </button>
          <button
            className="btn btn-danger"
            disabled={!stats?.live}
            onClick={() =>
              void send(() => setRedeemerIx(publicKey, null)).then(() => refresh())
            }
          >
            DISCONNECT
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------- treasury */}
      <section className="panel space-y-3">
        <h2 className="text-sm font-bold tracking-widest">TREASURY WITHDRAWAL</h2>
        <p className="text-xs text-mute">
          Whole tokens. Converted to base units before signing — no decimal maths in
          the input.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            inputMode="numeric"
            className="tnum flex-1 border-2 border-edge bg-ink px-3 py-2 text-sm outline-none focus:border-neon"
          />
          <button
            className="btn"
            disabled={!withdrawAmount || !PUMPBROKER_MINT}
            onClick={() => {
              if (!PUMPBROKER_MINT) return;
              const mint = new PublicKey(PUMPBROKER_MINT);
              void send(() =>
                withdrawTreasuryIx({
                  authority: publicKey,
                  paymentMint: mint,
                  destination: ata(publicKey, mint),
                  amount: BigInt(withdrawAmount) * 1_000_000n,
                }),
              ).then(() => refresh());
            }}
          >
            WITHDRAW
          </button>
        </div>
      </section>
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel mt-10 text-sm text-mute">
      <div className="label mb-2">Admin</div>
      {children}
    </div>
  );
}
