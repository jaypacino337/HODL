export default function Navbar() {
  const links = [
    { href: "#how-it-works", label: "How it works" },
    { href: "#tokenomics", label: "Tokenomics" },
    { href: "#stats", label: "Live stats" },
    { href: "#roadmap", label: "Roadmap" },
    { href: "#faq", label: "FAQ" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#06110c]/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-2 font-display text-lg font-semibold">
          <span aria-hidden>🏹</span>
          Sherwood <span className="text-sherwood-400">Protocol</span>
        </a>
        <div className="hidden items-center gap-8 text-sm text-white/70 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-white">
              {l.label}
            </a>
          ))}
        </div>
        <a
          href="#buy"
          className="rounded-full bg-gradient-to-r from-gold-500 to-sherwood-400 px-4 py-2 text-sm font-semibold text-[#06110c] transition hover:opacity-90"
        >
          Buy $ARROW
        </a>
      </nav>
    </header>
  );
}
