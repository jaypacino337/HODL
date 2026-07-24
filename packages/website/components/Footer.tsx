import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-ink-900/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[2fr,1fr,1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-7 w-7" />
            <span className="display text-base tracking-[0.08em]">
              OVER<span className="text-up-500">BID</span>
            </span>
          </div>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-moss">
            Trade where housing goes next. City-outcome shares collateralized in USDG, priced by an
            on-chain AMM, settled against housing price indexes. Built for Robinhood Chain.
          </p>
          <p className="mt-4 max-w-md text-xs leading-relaxed text-moss/70">
            This site currently runs in <b>demo mode</b>: paper trading with test balances, no real
            funds, no wallet. Prediction markets involve risk and may be restricted in your
            jurisdiction — nothing here is investment advice. Read the{" "}
            <a
              className="underline hover:text-paper"
              href="https://github.com/jaypacino337/HODL/blob/main/docs/DISCLAIMER.md"
            >
              disclaimer
            </a>
            .
          </p>
        </div>
        <div>
          <div className="eyebrow mb-3">Protocol</div>
          <ul className="space-y-2 text-sm text-moss">
            <li>
              <Link href="/#markets" className="hover:text-paper">
                Launch markets
              </Link>
            </li>
            <li>
              <Link href="/pool" className="hover:text-paper">
                House Pool
              </Link>
            </li>
            <li>
              <Link href="/#economics" className="hover:text-paper">
                Fee economics
              </Link>
            </li>
            <li>
              <Link href="/#roadmap" className="hover:text-paper">
                Roadmap
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="eyebrow mb-3">Build</div>
          <ul className="space-y-2 text-sm text-moss">
            <li>
              <a href="https://github.com/jaypacino337/HODL" className="hover:text-paper">
                GitHub
              </a>
            </li>
            <li>
              <a href="https://docs.parcllabs.com/" className="hover:text-paper">
                Parcl Labs data
              </a>
            </li>
            <li>
              <a href="https://github.com/jaypacino337/HODL/tree/main/packages/contracts" className="hover:text-paper">
                Contracts
              </a>
            </li>
            <li>
              <a href="https://github.com/jaypacino337/HODL/blob/main/docs/ARCHITECTURE.md" className="hover:text-paper">
                Architecture
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line py-4 text-center font-mono text-[0.7rem] uppercase tracking-[0.2em] text-moss/60">
        OVERBID · demo build · not an offer to trade
      </div>
    </footer>
  );
}
