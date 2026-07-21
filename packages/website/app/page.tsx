import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { GameBoard } from "@/components/GameBoard";
import { HowItWorks } from "@/components/HowItWorks";
import { HistoryPanels } from "@/components/HistoryPanels";
import { FAQ } from "@/components/FAQ";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <section id="play" className="mx-auto max-w-5xl px-4 pb-20">
        <GameBoard />
      </section>
      <HowItWorks />
      <HistoryPanels />
      <FAQ />
      <Footer />
    </main>
  );
}
