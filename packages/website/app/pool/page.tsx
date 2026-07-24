import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { PoolView } from "@/components/PoolView";

export const metadata: Metadata = {
  title: "House Pool — OVERBID",
  description:
    "Deposit USDG, receive ovLP. The House Pool seeds every market, earns 70% of trading fees plus settlement residuals, and carries the market risk.",
};

export default function PoolPage() {
  return (
    <>
      <Navbar />
      <PoolView />
      <Footer />
    </>
  );
}
