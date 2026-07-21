"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { RPC_URL } from "@/lib/config";

import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Wallet plumbing. An empty `wallets` array is intentional: every modern
 * Solana wallet (Phantom, Solflare, Backpack…) self-registers through the
 * Wallet Standard, so no per-wallet adapter packages are needed.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => RPC_URL, []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
