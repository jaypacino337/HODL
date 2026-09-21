"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

export function Providers({ children }: { children: React.ReactNode }) {
  /** The browser never sees an RPC key — it talks to our own proxy route. */
  const endpoint = useMemo(
    () => (typeof window === "undefined" ? "http://localhost/api/rpc" : `${window.location.origin}/api/rpc`),
    [],
  );

  // Empty adapter list on purpose: modern wallets register themselves through the
  // Wallet Standard, so listing them explicitly only risks duplicates in the modal.
  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
