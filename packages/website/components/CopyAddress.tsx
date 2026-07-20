"use client";

import { useState } from "react";

export default function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — silently ignore.
    }
  };

  return (
    <button
      onClick={onCopy}
      className="glass-card group flex w-full max-w-md items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition hover:border-sherwood-400/40 sm:w-auto"
    >
      <span className="truncate font-mono text-xs text-white/60 sm:text-sm">{address}</span>
      <span className="shrink-0 rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-sherwood-300 group-hover:bg-sherwood-400/20">
        {copied ? "Copied!" : "Copy CA"}
      </span>
    </button>
  );
}
