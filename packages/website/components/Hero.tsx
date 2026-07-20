import CopyAddress from "./CopyAddress";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_MINT_ADDRESS ?? "Not launched yet — check back soon";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-radial-fade pb-24 pt-20 sm:pt-28">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-40">
        <div className="absolute left-1/2 top-[-10rem] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-sherwood-500/20 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <span className="glass-card mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-sherwood-200">
          <span className="h-1.5 w-1.5 rounded-full bg-sherwood-400 pulse-dot" />
          Live on Solana · pump.fun
        </span>

        <h1 className="section-heading text-4xl font-bold leading-tight sm:text-6xl">
          Take from the trades.
          <br />
          <span className="gradient-text">Give to the holders.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-base text-white/60 sm:text-lg">
          Sherwood Protocol claims its own pump.fun creator fees, quietly compounds a share into
          deeper liquidity, then snapshots every holder and airdrops the rest back out —{" "}
          <span className="text-white/90">every 15 minutes, on-chain, no claiming required.</span>
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <CopyAddress address={CONTRACT_ADDRESS} />
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <a
              href="#buy"
              className="rounded-full bg-gradient-to-r from-gold-500 to-sherwood-400 px-6 py-3 text-sm font-semibold text-[#06110c] shadow-lg shadow-sherwood-500/20 transition hover:scale-[1.02]"
            >
              Buy on pump.fun
            </a>
            <a
              href="#how-it-works"
              className="glass-card rounded-full px-6 py-3 text-sm font-semibold text-white/80 transition hover:text-white"
            >
              How the mechanism works
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
