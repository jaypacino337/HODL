import { notFound } from "next/navigation";
import { LAUNCH_MARKETS, getMarket } from "@overbid/shared";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MarketView } from "@/components/MarketView";

export function generateStaticParams() {
  return LAUNCH_MARKETS.map((m) => ({ slug: m.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const market = getMarket(params.slug);
  return market
    ? { title: `${market.question} — OVERBID`, description: market.tagline }
    : { title: "OVERBID" };
}

export default function MarketPage({ params }: { params: { slug: string } }) {
  const market = getMarket(params.slug);
  if (!market) notFound();

  return (
    <>
      <Navbar />
      <MarketView slug={market.slug} />
      <Footer />
    </>
  );
}
