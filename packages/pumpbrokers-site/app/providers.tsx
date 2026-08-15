"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  /**
   * The browser never sees an RPC key. It talks to our own /api/rpc route, which
   * forwards a narrow allowlist of read methods to Helius server-side.
   */
  const endpoint = useMemo(() => {
    if (typeof window === "undefined") return "http://localhost/api/rpc";
    return `${window.location.origin}/api/rpc`;
  }, []);

  /**
   * Empty wallet list on purpose: every current wallet registers itself through the
   * Wallet Standard, so listing adapters explicitly only risks showing duplicates.
   */
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
