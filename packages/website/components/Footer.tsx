export default function Footer() {
  return (
    <footer id="buy" className="border-t border-white/5 bg-black/20">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <p className="flex items-center gap-2 font-display text-lg font-semibold">
              <span aria-hidden>🏹</span> Sherwood Protocol
            </p>
            <p className="mt-3 max-w-xs text-sm text-white/45">
              Take from the trades. Give to the holders. A Solana experiment in self-funding, self-distributing
              tokenomics.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-white/70">Links</p>
            <ul className="mt-3 space-y-2 text-sm text-white/45">
              <li><a className="hover:text-white" href="#">pump.fun listing (soon)</a></li>
              <li><a className="hover:text-white" href="#">Source code</a></li>
              <li><a className="hover:text-white" href="#">X / Twitter</a></li>
              <li><a className="hover:text-white" href="#">Telegram</a></li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-white/70">Risk disclaimer</p>
            <p className="mt-3 text-xs leading-relaxed text-white/40">
              $ARROW is an experimental, highly volatile digital asset with no intrinsic value or guaranteed return.
              Airdrop amounts depend entirely on trading-fee volume and can be zero. This is not investment, legal,
              or tax advice, and nothing here is an offer to sell securities in any jurisdiction. Only ever risk what
              you can afford to lose completely. Do your own research.
            </p>
          </div>
        </div>

        <p className="mt-10 border-t border-white/5 pt-6 text-xs text-white/30">
          © {new Date().getFullYear()} Sherwood Protocol. Not affiliated with Robinhood Markets, Inc. or pump.fun.
        </p>
      </div>
    </footer>
  );
}
