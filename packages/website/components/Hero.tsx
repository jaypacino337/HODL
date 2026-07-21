import Image from "next/image";

export function Hero() {
  return (
    <header className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pb-12 pt-10 text-center">
      <Image
        src="/logo.png"
        alt="HODL OR NO HODL — the on-chain game show"
        width={420}
        height={420}
        priority
        className="rounded-3xl shadow-glow-red"
      />
      <h1 className="sr-only">HODL OR NO HODL</h1>
      <p className="mt-8 max-w-2xl text-lg text-amber-100/90">
        The on-chain game show. Every <span className="font-bold text-gold-300">15 minutes</span> the
        creator fees are claimed straight into the pot. Hold{" "}
        <span className="font-bold text-gold-300">500K+ tokens</span>, pick your side, and if the flip
        lands your way you split the pot —{" "}
        <span className="font-bold text-gold-300">weighted by the size of your bag</span>.
      </p>
      <a
        href="#play"
        className="mt-8 rounded-full bg-gold-metal px-10 py-4 font-display text-2xl uppercase tracking-wider text-stage-950 shadow-glow-gold transition-transform hover:scale-105"
      >
        Open the case
      </a>
    </header>
  );
}
