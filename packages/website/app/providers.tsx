"use client";

import { DemoProvider } from "@/lib/DemoContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return <DemoProvider>{children}</DemoProvider>;
}
