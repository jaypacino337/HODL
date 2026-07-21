import { Navbar } from "@/components/Navbar";
import { HeroBanner } from "@/components/HeroBanner";
import { StageGame } from "@/components/StageGame";
import { HowItWorks } from "@/components/HowItWorks";
import { HistoryPanels } from "@/components/HistoryPanels";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <HeroBanner />
      <section id="play" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-20">
        <StageGame />
      </section>
      <HowItWorks />
      <HistoryPanels />
      <FAQ />
      <Footer />
    </main>
  );
}
