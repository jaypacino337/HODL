export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: "neon" | "down" | "mute";
}) {
  const colour =
    accent === "neon" ? "text-neon" : accent === "down" ? "text-down" : "text-bone";
  return (
    <div className="panel">
      <div className="label">{label}</div>
      <div className={`tnum mt-1 text-2xl font-bold ${colour}`}>{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-mute">{sub}</div> : null}
    </div>
  );
}

/**
 * Supply meter. Deliberately blocky: a fixed number of cells that fill in, not a
 * smooth bar. Nothing on this site interpolates.
 */
export function SupplyMeter({ minted, total }: { minted: number; total: number }) {
  const CELLS = 40;
  const filled = total > 0 ? Math.floor((minted / total) * CELLS) : 0;
  return (
    <div className="flex gap-[2px]" aria-label={`${minted} of ${total} minted`}>
      {Array.from({ length: CELLS }, (_, i) => (
        <div
          key={i}
          className={`h-4 flex-1 border ${
            i < filled ? "border-neon bg-neon" : "border-edge bg-slab"
          }`}
        />
      ))}
    </div>
  );
}
