const LAMPORTS_PER_SOL = 1_000_000_000;

export function formatSol(lamports: string | number | bigint, digits = 3): string {
  const n = Number(lamports) / LAMPORTS_PER_SOL;
  if (!isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function formatTokens(raw: string | bigint, decimals: number): string {
  const n = Number(raw) / 10 ** decimals;
  if (!isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function shortAddress(addr: string, chars = 4): string {
  if (addr.length <= chars * 2 + 3) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "00:00";
  const totalSec = Math.floor(msLeft / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
