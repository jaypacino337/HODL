import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import LiveStats from "@/components/LiveStats";
import HowItWorks from "@/components/HowItWorks";
import Tokenomics from "@/components/Tokenomics";
import Roadmap from "@/components/Roadmap";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
import { getStats } from "@/lib/api";

export const revalidate = 30;

export default async function Home() {
  const { stats, live } = await getStats();

  return (
    <main>
      <Navbar />
      <Hero />
      <LiveStats initial={stats} initiallyLive={live} />
      <HowItWorks />
      <Tokenomics />
      <Roadmap />
      <FAQ />
      <Footer />
    </main>
  );
}
