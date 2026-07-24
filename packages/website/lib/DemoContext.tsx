"use client";

import { createContext, useContext } from "react";
import { useDemo } from "./store";

type Demo = ReturnType<typeof useDemo>;

const Ctx = createContext<Demo | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const demo = useDemo();
  return <Ctx.Provider value={demo}>{children}</Ctx.Provider>;
}

export function useDemoCtx(): Demo {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemoCtx must be used inside <DemoProvider>");
  return ctx;
}
