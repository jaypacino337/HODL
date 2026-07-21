import { MINT_ADDRESS, PUMP_FUN_URL } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-ember-700/30 bg-stage-950 px-4 py-10">
      <div className="mx-auto max-w-5xl text-center text-sm text-smoked">
        <div className="anton gold-text text-xl">
          HODL OR NO HODL
        </div>
        {MINT_ADDRESS && (
          <div className="mt-3 font-mono text-xs break-all">
            <a href={PUMP_FUN_URL} className="hover:text-gold-300" target="_blank" rel="noreferrer">
              {MINT_ADDRESS}
            </a>
          </div>
        )}
        <p className="mx-auto mt-4 max-w-xl text-xs leading-relaxed text-smoked/70">
          This is a game of chance layered on a volatile memecoin. Payouts depend on trading fees
          actually accruing. Nothing here is financial advice; play with what you can afford to lose,
          and check your local laws before participating.
        </p>
      </div>
    </footer>
  );
}
