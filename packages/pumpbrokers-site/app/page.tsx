"use client";

import Link from "next/link";
import { formatTokens, ROUND_TRIP_SPREAD, TOTAL_SUPPLY } from "../../../config";
import { useStats } from "../lib/useStats";
import { Stat, SupplyMeter } from "../components/Stat";

export default function Landing() {
  const { stats } = useStats();

  const minted = stats?.minted ?? 0;
  const total = stats?.totalSupply ?? TOTAL_SUPPLY;
  const price = BigInt(stats?.price ?? "0");
  const treasury = BigInt(stats?.treasury ?? "0");
  const payout = BigInt(stats?.payout ?? "0");

  return (
    <div className="space-y-10">
      {/* ---------------------------------------------------------------- hero */}
      <section className="pt-4">
        <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
          1,000 PIXEL BROKERS
          <br />
          <span className="text-neon">ON SOLANA</span>
          <span className="ml-1 inline-block h-[0.9em] w-[0.5em] animate-blink bg-neon align-baseline" />
        </h1>

        <p className="mt-4 max-w-xl text-sm leading-relaxed text-mute">
          Mint a broker for{" "}
          <span className="text-bone">{formatTokens(price)} $PUMPBROKER</span>. Sell one
          back to the treasury for{" "}
          <span className="text-bone">{formatTokens(payout)}</span>, any time it can
          cover you. The{" "}
          <span className="text-neon">{formatTokens(ROUND_TRIP_SPREAD)}</span> spread
          per round trip stays in the treasury. That is the whole mechanism.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/mint" className="btn btn-primary">
            {stats?.isActive ? "MINT A BROKER" : "MINT OPENS AT LAUNCH"}
          </Link>
          <Link href="/gallery" className="btn">
            BROWSE ALL 1,000
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------- counters */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <span className="label">Supply</span>
          <span className="tnum text-sm">
            <span className="text-neon">{minted}</span>
            <span className="text-mute"> / {total}</span>
          </span>
        </div>
        <SupplyMeter minted={minted} total={total} />

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Mint price"
            value={formatTokens(price)}
            sub="$PUMPBROKER"
            accent="neon"
          />
          <Stat
            label="Treasury"
            value={formatTokens(treasury)}
            sub="$PUMPBROKER held by the program"
          />
          <Stat
            label="Buybacks available"
            value={stats?.buybackLive ? stats.redemptionsAvailable : "—"}
            sub={
              stats?.buybackLive
                ? `at ${formatTokens(payout)} each`
                : "sell-back opens after launch"
            }
            accent={stats?.buybackLive ? "neon" : "mute"}
          />
        </div>
      </section>

      {/* ------------------------------------------------------- cost honesty */}
      {/* This block exists because a wallet popup asking for SOL on a mint priced in
          $PUMPBROKER reads as being charged twice. Say it before they see it. */}
      <section className="panel-neon">
        <h2 className="text-sm font-bold tracking-widest text-neon">
          WHAT YOU ACTUALLY PAY
        </h2>
        <div className="mt-3 space-y-2 text-sm text-mute">
          <p>
            <span className="text-bone">{formatTokens(price)} $PUMPBROKER</span> — the
            mint price. It goes to a treasury owned by the program, not to a personal
            wallet.
          </p>
          <p>
            <span className="text-bone">~0.0025 SOL</span> — Solana&apos;s network rent
            to create your broker&apos;s account. This goes to the network, not to us.
            Your wallet will show it as part of the same transaction.
          </p>
          <p className="text-xs">
            Nothing is pre-minted. Your broker is created inside your own transaction,
            which is why the rent is yours and why the project pays nothing per mint.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section>
        <h2 className="mb-3 text-sm font-bold tracking-widest">HOW IT WORKS</h2>
        <ol className="space-y-3">
          {[
            [
              "Mint",
              `Pay ${formatTokens(price)} $PUMPBROKER. A broker is drawn at random from the unminted pool and created in your transaction.`,
            ],
            [
              "Reveal",
              "Which broker you drew is recorded on chain the moment you mint, but the artwork is published after the collection is fully drawn — so nobody can simulate a mint, see a rare one coming, and re-roll for free.",
            ],
            [
              "Hold or sell back",
              `Send a broker back to the treasury and take ${formatTokens(payout)} $PUMPBROKER. It returns to the pool and someone else can mint it — supply stays at exactly ${total}.`,
            ],
          ].map(([title, body], i) => (
            <li key={title} className="panel flex gap-4">
              <span className="text-2xl font-bold text-neon">{i + 1}</span>
              <div>
                <div className="text-sm font-bold">{title}</div>
                <p className="mt-1 text-xs leading-relaxed text-mute">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------------- status */}
      <section className="panel text-xs">
        <div className="label mb-2">Status</div>
        <ul className="space-y-1">
          <li>
            <StatusDot on={stats?.live ?? false} /> Mint program{" "}
            {stats?.live ? "deployed" : "not deployed yet"}
          </li>
          <li>
            <StatusDot on={stats?.isActive ?? false} /> Public mint{" "}
            {stats?.isActive ? "open" : "paused"}
          </li>
          <li>
            <StatusDot on={stats?.buybackLive ?? false} /> Sell-back{" "}
            {stats?.buybackLive ? "open" : "not live yet"}
          </li>
        </ul>
      </section>
    </div>
  );
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      className={`mr-2 inline-block h-2 w-2 align-middle ${on ? "bg-neon" : "bg-edge"}`}
    />
  );
}
