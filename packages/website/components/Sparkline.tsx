/** Tiny inline probability sparkline (SVG, no deps). */
export function Sparkline({
  points,
  width = 120,
  height = 34,
  strokeClass = "stroke-up-500",
}: {
  points: number[];
  width?: number;
  height?: number;
  strokeClass?: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 0.02);
  const pad = 3;
  const x = (i: number) => pad + (i / (points.length - 1)) * (width - pad * 2);
  const y = (p: number) => height - pad - ((p - min) / span) * (height - pad * 2);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const rising = points[points.length - 1] >= points[0];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path
        d={d}
        fill="none"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={rising ? strokeClass : "stroke-down-500"}
        opacity={0.9}
      />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r={2.4} className={rising ? "fill-up-400" : "fill-down-400"} />
    </svg>
  );
}
